import redisClient from "../configs/redisClient.js";
import Product from "../models/Product.js";
import { logger } from "../logger/logger.js";
import { createServiceError } from "../utils/serviceError.js";

// --- Redis Lua Scripts ---

const RESERVE_SCRIPT = `
local userId = ARGV[1]
local currentTime = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local newItems = cjson.decode(ARGV[4])

-- 1. Load existing reservation
local existingStr = redis.call('GET', KEYS[1])
local existingItems = {}
local currentVersion = 0
if existingStr then
    local existingData = cjson.decode(existingStr)
    if existingData then
        currentVersion = tonumber(existingData.version or "0")
        if existingData.items then
            for _, item in ipairs(existingData.items) do
                existingItems[item.productId] = item.quantity
            end
        end
    end
end

-- 2. Check stock availability and calculate deltas
local deltas = {}
local processed = {}
for _, item in ipairs(newItems) do
    local pId = item.productId
    local reqQty = tonumber(item.quantity)
    local dbStock = tonumber(item.dbStock)
    
    local prevQty = existingItems[pId] or 0
    local diff = reqQty - prevQty
    
    local expiryKey = "reserved:product:expiry:" .. pId
    local counterKey = "reserved:product:counter:" .. pId
    
    -- Clean up expired members first
    local expired = redis.call('ZRANGEBYSCORE', expiryKey, 0, currentTime)
    local sumExpired = 0
    for _, member in ipairs(expired) do
        local parts = {}
        for part in string.gmatch(member, "[^:]+") do
            table.insert(parts, part)
        end
        local mQty = tonumber(parts[2] or "0")
        -- Only decrement if we can successfully remove the expired member
        if redis.call('ZREM', expiryKey, member) == 1 then
            sumExpired = sumExpired + mQty
        end
    end
    
    if sumExpired > 0 then
        local currentCounter = tonumber(redis.call('GET', counterKey) or "0")
        local newCounterVal = currentCounter - sumExpired
        if newCounterVal < 0 then newCounterVal = 0 end
        redis.call('SET', counterKey, newCounterVal)
    end
    
    local currentReserved = tonumber(redis.call('GET', counterKey) or "0")
    -- O(1) stock availability calculation without scanning
    local currentReservedOthers = currentReserved - prevQty
    if currentReservedOthers < 0 then currentReservedOthers = 0 end
    
    if currentReservedOthers + reqQty > dbStock then
        return cjson.encode({ok = false, error = "out_of_stock", productId = pId, available = dbStock - currentReservedOthers})
    end
    
    deltas[pId] = { reqQty = reqQty, prevQty = prevQty, diff = diff }
    processed[pId] = true
end

-- 3. Apply changes: Update ZSETs and counters
for pId, info in pairs(deltas) do
    local expiryKey = "reserved:product:expiry:" .. pId
    local counterKey = "reserved:product:counter:" .. pId
    
    if info.prevQty > 0 then
        redis.call('ZREM', expiryKey, userId .. ":" .. info.prevQty)
    end
    redis.call('ZADD', expiryKey, currentTime + ttl, userId .. ":" .. info.reqQty)
    
    local currentCounter = tonumber(redis.call('GET', counterKey) or "0")
    local newCounterVal = currentCounter + info.diff
    if newCounterVal < 0 then newCounterVal = 0 end
    redis.call('SET', counterKey, newCounterVal)
end

-- Handle removed items
for pId, prevQty in pairs(existingItems) do
    if not processed[pId] then
        local expiryKey = "reserved:product:expiry:" .. pId
        local counterKey = "reserved:product:counter:" .. pId
        if redis.call('ZREM', expiryKey, userId .. ":" .. prevQty) == 1 then
            local currentCounter = tonumber(redis.call('GET', counterKey) or "0")
            local newCounterVal = currentCounter - prevQty
            if newCounterVal < 0 then newCounterVal = 0 end
            redis.call('SET', counterKey, newCounterVal)
        end
    end
end

-- 4. Save reservation
local nextVersion = currentVersion + 1
local resToSave = {
    userId = userId,
    version = nextVersion,
    updatedAt = currentTime,
    items = newItems
}
redis.call('SET', KEYS[1], cjson.encode(resToSave), 'EX', ttl)

return cjson.encode({ok = true, version = nextVersion})
`;

const REFRESH_SCRIPT = `
local userId = ARGV[1]
local currentTime = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local resStr = redis.call('GET', KEYS[1])
if not resStr then
    return cjson.encode({ok = false, error = "not_found"})
end

local resData = cjson.decode(resStr)
if resData and resData.items then
    for _, item in ipairs(resData.items) do
        local expiryKey = "reserved:product:expiry:" .. item.productId
        redis.call('ZADD', expiryKey, currentTime + ttl, userId .. ":" .. item.quantity)
    end
end

resData.updatedAt = currentTime
redis.call('SET', KEYS[1], cjson.encode(resData), 'EX', ttl)

return cjson.encode({ok = true})
`;

const COMMIT_SCRIPT = `
local userId = ARGV[1]

local resStr = redis.call('GET', KEYS[1])
if resStr then
    local resData = cjson.decode(resStr)
    if resData and resData.items then
        for _, item in ipairs(resData.items) do
            local expiryKey = "reserved:product:expiry:" .. item.productId
            local counterKey = "reserved:product:counter:" .. item.productId
            if redis.call('ZREM', expiryKey, userId .. ":" .. item.quantity) == 1 then
                local currentCounter = tonumber(redis.call('GET', counterKey) or "0")
                local newCounterVal = currentCounter - item.quantity
                if newCounterVal < 0 then newCounterVal = 0 end
                redis.call('SET', counterKey, newCounterVal)
            end
        end
    end
    redis.call('DEL', KEYS[1])
end
return 1
`;

const BATCH_STOCK_SCRIPT = `
local currentTime = tonumber(ARGV[1])
local results = {}
for i = 2, #ARGV do
    local pId = ARGV[i]
    local expiryKey = "reserved:product:expiry:" .. pId
    local counterKey = "reserved:product:counter:" .. pId
    
    -- Clean up expired members first
    local expired = redis.call('ZRANGEBYSCORE', expiryKey, 0, currentTime)
    local sumExpired = 0
    for _, member in ipairs(expired) do
        local parts = {}
        for part in string.gmatch(member, "[^:]+") do
            table.insert(parts, part)
        end
        local mQty = tonumber(parts[2] or "0")
        if redis.call('ZREM', expiryKey, member) == 1 then
            sumExpired = sumExpired + mQty
        end
    end
    
    if sumExpired > 0 then
        local currentCounter = tonumber(redis.call('GET', counterKey) or "0")
        local newCounterVal = currentCounter - sumExpired
        if newCounterVal < 0 then newCounterVal = 0 end
        redis.call('SET', counterKey, newCounterVal)
    end
    
    local currentReserved = tonumber(redis.call('GET', counterKey) or "0")
    table.insert(results, tostring(currentReserved))
end
return results
`;

// --- Service Implementations ---

export const reserveCheckoutStock = async (userId, items) => {
  if (!redisClient || !redisClient.isOpen) {
    throw createServiceError("Dịch vụ giữ hàng tạm thời không khả dụng.", 503);
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = 300; // 5 minutes

  // Load current DB stock for each product to act as the source of truth
  const itemsWithStock = [];
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw createServiceError(`Sản phẩm với ID ${item.productId} không tồn tại.`, 404);
    }
    itemsWithStock.push({
      productId: item.productId,
      quantity: item.quantity,
      dbStock: product.stock,
    });
  }

  const userResKey = `reservation:user:${userId}`;
  const resultStr = await redisClient.eval(RESERVE_SCRIPT, {
    keys: [userResKey],
    arguments: [
      userId.toString(),
      String(now),
      String(ttl),
      JSON.stringify(itemsWithStock),
    ],
  });

  const result = JSON.parse(resultStr);
  if (!result.ok) {
    if (result.error === "out_of_stock") {
      const product = await Product.findById(result.productId);
      throw createServiceError(
        `Sản phẩm "${product?.name || result.productId}" không đủ số lượng trong kho. Số lượng khả dụng: ${result.available}`,
        400
      );
    }
    throw createServiceError("Không thể hoàn tất giữ hàng.", 400);
  }

  return { ok: true, version: result.version };
};

export const refreshCheckoutStock = async (userId) => {
  if (!redisClient || !redisClient.isOpen) {
    throw createServiceError("Dịch vụ giữ hàng tạm thời không khả dụng.", 503);
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = 300; // 5 minutes
  const userResKey = `reservation:user:${userId}`;

  const resultStr = await redisClient.eval(REFRESH_SCRIPT, {
    keys: [userResKey],
    arguments: [userId.toString(), String(now), String(ttl)],
  });

  const result = JSON.parse(resultStr);
  if (!result.ok) {
    throw createServiceError("Không tìm thấy giữ hàng của bạn hoặc phiên giữ hàng đã hết hạn.", 404);
  }

  return { ok: true };
};

export const commitCheckoutStock = async (userId) => {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn(`Could not commit checkout stock for user ${userId} because Redis is unavailable.`);
    return;
  }
  const userResKey = `reservation:user:${userId}`;
  await redisClient.eval(COMMIT_SCRIPT, {
    keys: [userResKey],
    arguments: [userId.toString()],
  });
};

export const releaseCheckoutStock = async (userId) => {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn(`Could not release checkout stock for user ${userId} because Redis is unavailable.`);
    return;
  }
  const userResKey = `reservation:user:${userId}`;
  await redisClient.eval(COMMIT_SCRIPT, {
    keys: [userResKey],
    arguments: [userId.toString()],
  });
};


export const adjustProductsStockWithReservations = async (products) => {
  if (!products) return products;
  if (!redisClient || !redisClient.isOpen) return products;

  const isArray = Array.isArray(products);
  const prodList = isArray ? products : [products];
  if (prodList.length === 0) return products;

  const productIds = prodList
    .map((p) => {
      const id = p._id || p.id;
      return id ? id.toString() : null;
    })
    .filter(Boolean);

  if (productIds.length === 0) return products;

  const now = Math.floor(Date.now() / 1000);
  try {
    const reservedQuantities = await redisClient.eval(BATCH_STOCK_SCRIPT, {
      keys: [],
      arguments: [String(now), ...productIds],
    });

    const reservedMap = {};
    productIds.forEach((id, index) => {
      reservedMap[id] = parseInt(reservedQuantities[index] || "0", 10);
    });

    prodList.forEach((p) => {
      const id = p._id || p.id;
      if (id) {
        const pId = id.toString();
        const reservedQty = reservedMap[pId] || 0;
        if (typeof p.toObject === "function") {
          // If it is a Mongoose document, mutate the underlying object properties
          p.stock = Math.max(0, (p.stock || 0) - reservedQty);
        } else {
          p.stock = Math.max(0, (p.stock || 0) - reservedQty);
        }
      }
    });
  } catch (error) {
    logger.error("Failed to adjust product stock with reservations:", { message: error.message });
  }

  return isArray ? prodList : prodList[0];
};
