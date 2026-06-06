import crypto from "crypto";

//tạo chữ ký cho request tạo đơn
export const buildMomoCreateRawSignature = ({
  accessKey = "",
  amount = "",
  extraData = "",
  ipnUrl = "",
  orderId = "",
  orderInfo = "",
  partnerCode = "",
  redirectUrl = "",
  requestId = "",
  requestType = "",
}) => {
  return `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
};

// Hàm này có thể được sử dụng chung cho cả tạo đơn và IPN nếu cần, nhưng hiện tại chúng ta sẽ giữ riêng để dễ quản lý
export const buildMomoIpnRawSignature = ({
  accessKey = "",
  amount = "",
  extraData = "",
  message = "",
  orderId = "",
  orderInfo = "",
  orderType = "",
  partnerCode = "",
  payType = "",
  requestId = "",
  responseTime = "",
  resultCode = "",
  transId = "",
}) => {
  return `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
};

// Hàm này có thể được sử dụng chung cho cả tạo đơn và IPN nếu cần, nhưng hiện tại chúng ta sẽ giữ riêng để dễ quản lý
export const generateMomoSignature = (rawSignature, secretKey) => {
  return crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
};

// Hàm verifyMomoSignature có thể được sử dụng trong cả quá trình tạo đơn và xử lý IPN nếu cần thiết, nhưng hiện tại chúng ta sẽ sử dụng chủ yếu cho IPN
export const verifyMomoSignature = (payload, secretKey) => {
  if (!payload || !payload.signature) {
    return false;
  }
  // Đối với IPN, chúng ta sẽ sử dụng buildMomoIpnRawSignature để tạo chuỗi ký tự gốc, sau đó so sánh với chữ ký trong payload
  const rawSignature = buildMomoIpnRawSignature({
    accessKey: payload.accessKey,
    amount: payload.amount,
    extraData: payload.extraData || "",
    message: payload.message || "",
    orderId: payload.orderId,
    orderInfo: payload.orderInfo || "",
    orderType: payload.orderType || "",
    partnerCode: payload.partnerCode,
    payType: payload.payType || "",
    requestId: payload.requestId,
    responseTime: payload.responseTime || "",
    resultCode: payload.resultCode,
    transId: payload.transId || "",
  });
  // So sánh chữ ký được tạo ra với chữ ký trong payload
  return generateMomoSignature(rawSignature, secretKey) === payload.signature;
};
