import { prisma } from "../prisma.js"
import type { Request, Response } from "express"

export const getAdminStats = async (req: Request, res: Response) => {
  const [totalOrders, totalUsers, totalProducts, outOfStock, totalPartners] =
    await Promise.all([
      prisma.order.count({ where: { NOT: [{ paymentMethod: "card", isPaid: false }] } }),
      prisma.user.count(),
      prisma.product.count(),
      prisma.product.count({ where: { stock: 0 } }),
      prisma.deliveryPartner.count(),
    ])

  const recentOrders = await prisma.order.findMany({
    where: { NOT: [{ paymentMethod: "card", isPaid: false }] },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      user: { select: { name: true, email: true } },
      deliveryPartner: { select: { name: true, phone: true } },
    },
  })

  res.json({ totalOrders, totalUsers, totalProducts, outOfStock, totalPartners, recentOrders })
}

