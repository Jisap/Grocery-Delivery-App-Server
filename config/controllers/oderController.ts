


// Create order

import { Request, Response } from "express";
import { prisma } from "../prisma.js";

// POST /api/orders
export const createOrder = async (req: Request, res: Response) => {

  // Receive order items from body
  const [items, shippingAddress, paymentMethod] = req.body;

  // Check if order items are empty
  if (!items || items.length === 0) {
    return res.status(400).json({ message: "No order items" })
  }

  // Look up actual prices from the database
  const productIds = items.map((i: any) => i.product); // Extract product ids from order items
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }                 // Find products that match the product ids
  });
  const productMap: Record<string, (typeof products)[0]> = {}

  products.forEach((p: any) => (productMap[p.id] = p))

  // Check if product is in stock
  for (const item of items) {
    const product = productMap[item.product];
    if (!product || (product.stock ?? 0) < item.quantity) {
      return res.status(400).json({ message: `Product ${product?.name} is out of stock` })
    }
  }

  const orderItems = items.map((item: any) => {
    const dbProduct = productMap[item.product];
    if (!dbProduct) throw new Error(`Product ${item.product} not found`)
    return {
      product: dbProduct.id,
      name: dbProduct.name,
      image: dbProduct.image,
      price: dbProduct.price,
      quantity: item.quantity,
      unit: dbProduct.unit,
    }
  })

  const subtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal > 20 ? 0 : 1.99;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

  const order = await prisma.order.create({
    data: {
      userId: req.user!.id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      subtotal,
      deliveryFee,
      tax,
      total,
      statusHistory: [{ status: 'Placed', note: 'Order placed Successfully', timesStamp: new Date() }]
    }
  })

  if (paymentMethod === "card") {
    // Stripe payment link
  }

  res.json({ order });

  // Decrease stock
  for (const item of orderItems) {
    await prisma.product.update({
      where: { id: item.product },
      data: { stock: { decrement: item.quantity } }
    })
  }
}