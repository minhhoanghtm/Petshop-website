import dotenv from "dotenv";
dotenv.config();
import { createClient } from "redis";
import { logger } from "../logger/logger.js";

let redisClient;

const useMock = process.env.NODE_ENV === "test" && !process.env.USE_REAL_REDIS;

if (useMock) {
    logger.info("Initializing in-memory mock Redis client for testing...");
    const store = new Map();
    const ttls = new Map();

    const isExpired = (key) => {
        if (!ttls.has(key)) return false;
        const expireAt = ttls.get(key);
        if (Date.now() >= expireAt) {
            store.delete(key);
            ttls.delete(key);
            return true;
        }
        return false;
    };

    redisClient = {
        isOpen: true,
        isMock: true,
        on: () => redisClient,
        connect: async () => redisClient,
        disconnect: async () => {},
        quit: async () => {},
        ping: async () => "PONG",
        exists: async (key) => {
            if (isExpired(key)) return 0;
            return store.has(key) ? 1 : 0;
        },
        get: async (key) => {
            if (isExpired(key)) return null;
            const val = store.get(key);
            return val !== undefined ? String(val) : null;
        },
        set: async (key, value, options) => {
            store.set(key, value);
            if (options && options.EX) {
                ttls.set(key, Date.now() + options.EX * 1000);
            } else {
                ttls.delete(key);
            }
            return "OK";
        },
        del: async (keys) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            let count = 0;
            for (const k of keyList) {
                if (store.has(k)) {
                    store.delete(k);
                    ttls.delete(k);
                    count++;
                }
            }
            return count;
        },
        incr: async (key) => {
            if (isExpired(key)) {
                store.set(key, 0);
            }
            const val = Number(store.get(key) || 0) + 1;
            store.set(key, val);
            return val;
        },
        decr: async (key) => {
            if (isExpired(key)) {
                store.set(key, 0);
            }
            const val = Number(store.get(key) || 0) - 1;
            store.set(key, val);
            return val;
        },
        incrBy: async (key, amount) => {
            if (isExpired(key)) {
                store.set(key, 0);
            }
            const val = Number(store.get(key) || 0) + Number(amount);
            store.set(key, val);
            return val;
        },
        decrBy: async (key, amount) => {
            if (isExpired(key)) {
                store.set(key, 0);
            }
            const val = Number(store.get(key) || 0) - Number(amount);
            store.set(key, val);
            return val;
        },
        sAdd: async (key, member) => {
            if (isExpired(key)) {
                store.delete(key);
            }
            let set = store.get(key);
            if (!(set instanceof Set)) {
                set = new Set();
                store.set(key, set);
            }
            const sizeBefore = set.size;
            set.add(String(member));
            return set.size - sizeBefore;
        },
        sMembers: async (key) => {
            if (isExpired(key)) {
                return [];
            }
            const set = store.get(key);
            if (set instanceof Set) {
                return Array.from(set);
            }
            return [];
        },
        sRem: async (key, member) => {
            if (isExpired(key)) {
                return 0;
            }
            const set = store.get(key);
            if (set instanceof Set) {
                const deleted = set.delete(String(member));
                if (set.size === 0) {
                    store.delete(key);
                }
                return deleted ? 1 : 0;
            }
            return 0;
        },
        sCard: async (key) => {
            if (isExpired(key)) {
                return 0;
            }
            const set = store.get(key);
            if (set instanceof Set) {
                return set.size;
            }
            return 0;
        },
        sIsMember: async (key, member) => {
            if (isExpired(key)) {
                return 0;
            }
            const set = store.get(key);
            if (set instanceof Set) {
                return set.has(String(member)) ? 1 : 0;
            }
            return 0;
        },
        expire: async (key, seconds) => {
            if (store.has(key)) {
                ttls.set(key, Date.now() + seconds * 1000);
                return 1;
            }
            return 0;
        },
        ttl: async (key) => {
            if (!store.has(key) || isExpired(key)) {
                return -2;
            }
            if (!ttls.has(key)) {
                return -1;
            }
            const remainingMs = ttls.get(key) - Date.now();
            return Math.max(0, Math.ceil(remainingMs / 1000));
        },
        zAdd: async (key, score, member) => {
            let set = store.get(key);
            if (!(set instanceof Map)) {
                set = new Map();
                store.set(key, set);
            }
            if (typeof score === "object") {
                const entries = Array.isArray(score) ? score : [score];
                for (const entry of entries) {
                    set.set(entry.value, entry.score);
                }
                return entries.length;
            } else {
                set.set(String(member), Number(score));
                return 1;
            }
        },
        zRemRangeByScore: async (key, min, max) => {
            const set = store.get(key);
            if (!(set instanceof Map)) return 0;
            let count = 0;
            for (const [member, score] of set.entries()) {
                if (score >= min && score <= max) {
                    set.delete(member);
                    count++;
                }
            }
            return count;
        },
        zRange: async (key, start, stop) => {
            const set = store.get(key);
            if (!(set instanceof Map)) return [];
            return Array.from(set.keys());
        },
        zRem: async (key, member) => {
            const set = store.get(key);
            if (!(set instanceof Map)) return 0;
            return set.delete(String(member)) ? 1 : 0;
        },
        eval: async (script, options) => {
            const keys = options?.keys || [];
            const args = options?.arguments || [];

            if (script.includes("currentVersion")) {
                // checkout-reserve script
                const userId = args[0];
                const currentTime = Number(args[1]);
                const ttl = Number(args[2]);
                const newItems = JSON.parse(args[3]);

                const resKey = keys[0];
                const existingStr = store.get(resKey);
                const existingItems = {};
                let currentVersion = 0;
                if (existingStr) {
                    const existingData = JSON.parse(existingStr);
                    if (existingData) {
                        currentVersion = Number(existingData.version || "0");
                        if (existingData.items) {
                            for (const item of existingData.items) {
                                existingItems[item.productId] = item.quantity;
                            }
                        }
                    }
                }

                const deltas = {};
                const processed = {};
                for (const item of newItems) {
                    const pId = item.productId;
                    const reqQty = Number(item.quantity);
                    const dbStock = Number(item.dbStock);

                    const prevQty = existingItems[pId] || 0;
                    const diff = reqQty - prevQty;

                    const expiryKey = `reserved:product:expiry:${pId}`;
                    const counterKey = `reserved:product:counter:${pId}`;

                    // Clean up expired members first
                    const set = store.get(expiryKey);
                    let sumExpired = 0;
                    if (set instanceof Map) {
                        for (const [member, score] of set.entries()) {
                            if (score <= currentTime) {
                                const parts = member.split(":");
                                const mQty = Number(parts[1] || "0");
                                set.delete(member);
                                sumExpired += mQty;
                            }
                        }
                    }

                    if (sumExpired > 0) {
                        const currentCounter = Number(store.get(counterKey) || 0);
                        const newCounterVal = Math.max(0, currentCounter - sumExpired);
                        store.set(counterKey, newCounterVal);
                    }

                    const currentReserved = Number(store.get(counterKey) || 0);
                    let currentReservedOthers = currentReserved - prevQty;
                    if (currentReservedOthers < 0) currentReservedOthers = 0;

                    if (currentReservedOthers + reqQty > dbStock) {
                        return JSON.stringify({
                            ok: false,
                            error: "out_of_stock",
                            productId: pId,
                            available: dbStock - currentReservedOthers,
                        });
                    }

                    deltas[pId] = { reqQty, prevQty, diff };
                    processed[pId] = true;
                }

                for (const [pId, info] of Object.entries(deltas)) {
                    const expiryKey = `reserved:product:expiry:${pId}`;
                    const counterKey = `reserved:product:counter:${pId}`;

                    if (info.prevQty > 0) {
                        const set = store.get(expiryKey);
                        if (set instanceof Map) {
                            set.delete(`${userId}:${info.prevQty}`);
                        }
                    }
                    let set = store.get(expiryKey);
                    if (!(set instanceof Map)) {
                        set = new Map();
                        store.set(expiryKey, set);
                    }
                    set.set(`${userId}:${info.reqQty}`, currentTime + ttl);

                    const currentCounter = Number(store.get(counterKey) || 0);
                    const newCounterVal = Math.max(0, currentCounter + info.diff);
                    store.set(counterKey, newCounterVal);
                }

                for (const [pId, prevQty] of Object.entries(existingItems)) {
                    if (!processed[pId]) {
                        const expiryKey = `reserved:product:expiry:${pId}`;
                        const counterKey = `reserved:product:counter:${pId}`;
                        const set = store.get(expiryKey);
                        if (set instanceof Map) {
                            set.delete(`${userId}:${prevQty}`);
                        }
                        const currentCounter = Number(store.get(counterKey) || 0);
                        const newCounterVal = Math.max(0, currentCounter - prevQty);
                        store.set(counterKey, newCounterVal);
                    }
                }

                const nextVersion = currentVersion + 1;
                const resToSave = {
                    userId,
                    version: nextVersion,
                    updatedAt: currentTime,
                    items: newItems,
                };
                store.set(resKey, JSON.stringify(resToSave));
                ttls.set(resKey, Date.now() + ttl * 1000);

                return JSON.stringify({ ok: true, version: nextVersion });
            } else if (script.includes("EXPIRE") || (script.includes("not_found") && script.includes("ZADD"))) {
                // checkout-refresh script
                const userId = args[0];
                const currentTime = Number(args[1]);
                const ttl = Number(args[2]);

                const resKey = keys[0];
                const resStr = store.get(resKey);
                if (!resStr) {
                    return JSON.stringify({ ok: false, error: "not_found" });
                }

                const resData = JSON.parse(resStr);
                if (resData && resData.items) {
                    for (const item of resData.items) {
                        const expiryKey = `reserved:product:expiry:${item.productId}`;
                        let set = store.get(expiryKey);
                        if (!(set instanceof Map)) {
                            set = new Map();
                            store.set(expiryKey, set);
                        }
                        set.set(`${userId}:${item.quantity}`, currentTime + ttl);
                    }
                }

                resData.updatedAt = currentTime;
                store.set(resKey, JSON.stringify(resData));
                ttls.set(resKey, Date.now() + ttl * 1000);

                return JSON.stringify({ ok: true });
            } else if (script.includes("DEL") && script.includes("ZREM")) {
                // checkout-commit script
                const userId = args[0];
                const resKey = keys[0];
                const resStr = store.get(resKey);
                if (resStr) {
                    const resData = JSON.parse(resStr);
                    if (resData && resData.items) {
                        for (const item of resData.items) {
                            const expiryKey = `reserved:product:expiry:${item.productId}`;
                            const counterKey = `reserved:product:counter:${item.productId}`;
                            const set = store.get(expiryKey);
                            if (set instanceof Map) {
                                if (set.delete(`${userId}:${item.quantity}`)) {
                                    const currentCounter = Number(store.get(counterKey) || 0);
                                    const newCounterVal = Math.max(0, currentCounter - item.quantity);
                                    store.set(counterKey, newCounterVal);
                                }
                            }
                        }
                    }
                    store.delete(resKey);
                    ttls.delete(resKey);
                }
                return 1;
            } else if (script.includes("results = {}")) {
                // batch stock checking script
                const currentTime = Number(args[0]);
                const results = [];
                for (let i = 1; i < args.length; i++) {
                    const pId = args[i];
                    const expiryKey = `reserved:product:expiry:${pId}`;
                    const counterKey = `reserved:product:counter:${pId}`;

                    const set = store.get(expiryKey);
                    let sumExpired = 0;
                    if (set instanceof Map) {
                        for (const [member, score] of set.entries()) {
                            if (score <= currentTime) {
                                const parts = member.split(":");
                                const mQty = Number(parts[1] || "0");
                                set.delete(member);
                                sumExpired += mQty;
                            }
                        }
                    }

                    if (sumExpired > 0) {
                        const currentCounter = Number(store.get(counterKey) || 0);
                        const newCounterVal = Math.max(0, currentCounter - sumExpired);
                        store.set(counterKey, newCounterVal);
                    }

                    const currentReserved = Number(store.get(counterKey) || 0);
                    results.push(String(currentReserved));
                }
                return results;
            }
            throw new Error(`Unsupported script in mock Redis eval: ${script}`);
        },
        multi: () => {
            const queue = [];
            const chain = {
                zRemRangeByScore: (key, min, max) => {
                    queue.push(async () => {
                        const set = store.get(key);
                        if (!(set instanceof Map)) return 0;
                        let count = 0;
                        for (const [member, score] of set.entries()) {
                            if (score >= min && score <= max) {
                                set.delete(member);
                                count++;
                            }
                        }
                        return count;
                    });
                    return chain;
                },
                zRange: (key, start, stop) => {
                    queue.push(async () => {
                        const set = store.get(key);
                        if (!(set instanceof Map)) return [];
                        return Array.from(set.keys());
                    });
                    return chain;
                },
                get: (key) => {
                    queue.push(async () => {
                        if (isExpired(key)) return null;
                        const val = store.get(key);
                        return val !== undefined ? String(val) : null;
                    });
                    return chain;
                },
                exec: async () => {
                    const results = [];
                    for (const op of queue) {
                        results.push(await op());
                    }
                    return results;
                },
            };
            return chain;
        },
    };
} else {
    // Tạo một client Redis mới
    redisClient = createClient({
        url: process.env.REDIS_URL,
        socket: {
            connectTimeout: 5000,
        },
        maxRetriesPerRequest: null,
    });

    // Xử lý lỗi kết nối Redis
    redisClient.on("error", (err) => {
        logger.error("Redis client error", { message: err.message });
    });

    redisClient.on("connect", () => {
        logger.info("Redis client connecting");
    });

    redisClient.on("ready", () => {
        logger.info("Redis client ready");
    });

    redisClient.on("reconnecting", (delay) => {
        logger.warn("Redis client reconnecting", { delay });
    });

    redisClient.on("end", () => {
        logger.warn("Redis client disconnected");
    });

    // Kết nối đến Redis bất đồng bộ ở background để không block import module
    redisClient.connect().then(() => {
        logger.info("Redis client connected");
    }).catch((error) => {
        logger.warn("Redis client initial connection failed, will retry", {
            message: error.message,
        });
    });
}

export default redisClient;