


// Create order

import { Request, Response } from "express";
import { prisma } from "../prisma.js";

// // POST /api/orders
// export const createOrder = async (req: Request, res: Response) => {

//   // Receive order items from body
//   const { items, shippingAddress, paymentMethod } = req.body;

//   // Check if order items are empty
//   if (!items || items.length === 0) {
//     return res.status(400).json({ message: "No order items" })
//   }

//   // Look up actual prices from the database
//   const productIds = items.map((i: any) => i.product); // Extract product ids from order items
//   const products = await prisma.product.findMany({
//     where: { id: { in: productIds } }                 // Find products that match the product ids
//   });
//   const productMap: Record<string, (typeof products)[0]> = {}

//   products.forEach((p: any) => (productMap[p.id] = p))

//   // Check if product is in stock
//   for (const item of items) {
//     const product = productMap[item.product];
//     if (!product || (product.stock ?? 0) < item.quantity) {
//       return res.status(400).json({ message: `Product ${product?.name} is out of stock` })
//     }
//   }

//   const orderItems = items.map((item: any) => {
//     const dbProduct = productMap[item.product];
//     if (!dbProduct) throw new Error(`Product ${item.product} not found`)
//     return {
//       product: dbProduct.id,
//       name: dbProduct.name,
//       image: dbProduct.image,
//       price: dbProduct.price,
//       quantity: item.quantity,
//       unit: dbProduct.unit,
//     }
//   })

//   const subtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
//   const deliveryFee = subtotal > 20 ? 0 : 1.99;
//   const tax = Math.round(subtotal * 0.08 * 100) / 100;
//   const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;

//   const order = await prisma.order.create({
//     data: {
//       userId: req.user!.id,
//       items: orderItems,
//       shippingAddress,
//       paymentMethod,
//       subtotal,
//       deliveryFee,
//       tax,
//       total,
//       statusHistory: [{ status: 'Placed', note: 'Order placed Successfully', timesStamp: new Date() }]
//     }
//   })

//   if (paymentMethod === "card") {
//     // Stripe payment link
//   }

//   res.json({ order });

//   // Decrease stock
//   for (const item of orderItems) {
//     await prisma.product.update({
//       where: { id: item.product },
//       data: { stock: { decrement: item.quantity } }
//     })
//   }
// }

type OrderItem = {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  unit: string;
};

export const createOrder = async (req: Request, res: Response) => {
  const { items, shippingAddress, paymentMethod } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ message: "No order items" });
  }

  try {
    // Usamos $transaction para crear la orden de manera atómica: 
    // si algo falla, se revierte todo. Recordar que tenemos 3 operaciones
    // que podrían fallar: tx.product.findMany, tx.order.create, tx.product.updateMany 
    const order = await prisma.$transaction(async (tx) => {
      const productIds = items.map((i: any) => i.product);                               // Cada elemento i es un objeto: { "product": "64f1a2b3c4d5e6f7", "quantity": 2 }. De este objeto obtenemos el product que corresponde con el id
      const products = await tx.product.findMany({ where: { id: { in: productIds } } }); // Buscamos todos los productos que coincidan con los ids obtenidos
      const productMap: Record<string, (typeof products)[0]> = {};                       // Creamos un objeto para poder acceder a los productos por su id
      products.forEach((p) => (productMap[p.id] = p));                                   // Recorremos el array de productos y los añadimos al objeto

      const orderItems: OrderItem[] = items.map((item: any) => {                         // Se recorre cada item del carrito 
        const dbProduct = productMap[item.product];                                      // y se verifica, contra productMap
        if (!dbProduct) throw new Error(`Product ${item.product} not found`);            // que exista
        if ((dbProduct.stock ?? 0) < item.quantity) {                                    // y que haya stock suficiente
          throw new Error(`Product ${dbProduct.name} is out of stock`);
        }
        return {                                                                         // se forma el objeto orderItem
          product: dbProduct.id,
          name: dbProduct.name,
          image: dbProduct.image,
          price: dbProduct.price,
          quantity: item.quantity,
          unit: dbProduct.unit,
        };
      });

      const subtotal = orderItems.reduce((s, i) => s + i.price * i.quantity, 0);         // suma de price * quantity de cada item.   
      const deliveryFee = subtotal > 20 ? 0 : 1.99;                                      // deliveryFee = gratis si subtotal > 20, sino 1.99.
      const tax = Math.round(subtotal * 0.08 * 100) / 100;                               // tax = 8% del subtotal redondeado a 2 decimales.
      const total = Math.round((subtotal + deliveryFee + tax) * 100) / 100;              // total = suma de los tres, también redondeado.

      const created = await tx.order.create({                                            // Se crea el registro Order en la base de datos con todos los datos calculados, más un statusHistory inicial con estado "Placed". En este punto la orden ya existe en la BD, pero el stock todavía no se descontó y el pago todavía no se procesó. 
        data: {
          userId: req.user!.id,
          items: orderItems,
          shippingAddress,
          paymentMethod,
          subtotal,
          deliveryFee,
          tax,
          total,
          statusHistory: [{ status: "Placed", note: "Order placed Successfully", timesStamp: new Date() }],
        },
      });

      if (paymentMethod === "card") {
        //Stripe payment link
      }

      for (const item of orderItems) {                                                    // Se procede a decrementar el stock de cada producto
        const result = await tx.product.updateMany({
          where: { id: item.product, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          throw new Error(`Product ${item.name} is out of stock`);
        }
      }

      return created;
    });

    res.json({ order });
  } catch (err: any) {
    res.status(400).json({ message: err.message ?? "Could not create order" });
  }
};