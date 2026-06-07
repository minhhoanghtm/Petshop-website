import { RateLimiterRedis } from 'rate-limiter-flexible';
import redisClient from '../../config/redisClient.js';
// keyPrefix: đặt tên cho limiter, thường là tên của route hoặc chức năng mà bạn muốn giới hạn
// points: số điểm (requests) mà một client có thể thực hiện trong khoảng thời gian nhất định
// duration: khoảng thời gian (tính bằng giây) mà các điểm sẽ được reset về 0
// blockDuration: khoảng thời gian (tính bằng giây) mà client sẽ bị chặn nếu vượt quá giới hạn
export const createLimiter = ({ keyPrefix, points, duration, blockDuration }) => {
    return new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix,
        points,
        duration,
        blockDuration
    })
};