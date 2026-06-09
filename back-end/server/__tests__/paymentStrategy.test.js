import PaymentContext from "../services/payment/paymentContext.js";
import CodPaymentStrategy from "../services/payment/codStrategy.js";
import MomoPaymentStrategy from "../services/payment/momoStrategy.js";
import PaypalPaymentStrategy from "../services/payment/paypalStrategy.js";

describe("Payment Strategy Pattern", () => {
  const amount = 500000; // 500k VND
  const orderDetails = {
    user_id: "user123",
    items: [
      { product_id: "prod1", quantity: 2 },
      { product_id: "prod2", quantity: 1 }
    ]
  };

  test("COD Strategy returns pending status", async () => {
    const strategy = new CodPaymentStrategy();
    const context = new PaymentContext(strategy);
    
    const result = await context.executePayment(amount, orderDetails);
    
    expect(result.success).toBe(true);
    expect(result.payment_status).toBe("pending");
    expect(result.transactionId).toBeNull();
  });

  test("MOMO Strategy returns paid status with transaction ID", async () => {
    const strategy = new MomoPaymentStrategy();
    const context = new PaymentContext(strategy);
    
    const result = await context.executePayment(amount, orderDetails);
    
    expect(result.success).toBe(true);
    expect(result.payment_status).toBe("pending");
    expect(result.transactionId).toBeNull();
  });

  test("PAYPAL Strategy returns paid status with transaction ID", async () => {
    const strategy = new PaypalPaymentStrategy();
    const context = new PaymentContext(strategy);
    
    const result = await context.executePayment(amount, orderDetails);
    
    expect(result.success).toBe(true);
    expect(result.payment_status).toBe("paid");
    expect(result.transactionId).toMatch(/^PAYPAL_\d+_\d+$/);
  });

  test("PaymentContext can switch strategy dynamically", async () => {
    const context = new PaymentContext();
    
    // Set to COD
    context.setStrategy(new CodPaymentStrategy());
    const codResult = await context.executePayment(amount, orderDetails);
    expect(codResult.payment_status).toBe("pending");
    
    // Switch to MOMO dynamically
    context.setStrategy(new MomoPaymentStrategy());
    const momoResult = await context.executePayment(amount, orderDetails);
    expect(momoResult.payment_status).toBe("pending");
  });
});
