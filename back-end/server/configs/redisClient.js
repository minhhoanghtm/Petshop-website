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
        }
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