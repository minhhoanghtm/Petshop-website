export class PaymentStrategy {
  async processPayment(amount, orderDetails) {
    throw new Error("Hàm processPayment chưa được hiện thực!");
  }

  async createPayment(order, user) {
    throw new Error("Hàm createPayment chưa được hiện thực!");
  }

  verifyCallback(payload) {
    throw new Error("Hàm verifyCallback chưa được hiện thực!");
  }
}

export default PaymentStrategy;
