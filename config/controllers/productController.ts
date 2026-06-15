import { Request, Response } from "express";
import { prisma } from "../prisma.js"


// GET /api/products/flash-deals
export const getFlashDeals = async (req: Request, res: Response) => {
  const products = await prisma.product.findMany({
    where: { stock: { gt: 0 } },
    orderBy: { originalPrice: "desc" }
  });

  const productsWithDiscount = products.map((p: any) => {
    const discount = p.originalPrice && p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : 0;
    return { ...p, discount }
  });

  res.json({ products: productsWithDiscount.slice(0, 8) })
}

// GET /api/products
export const getProducts = async (req: Request, res: Response) => {
  const { category, search, minPrice, maxPrice, sort } = req.query;                 // Todo lo que venga en ?category=ropa&search=zap&sort=price-low se desempaqueta.

  const where: any = {};                                                            // Inicializamos un objeto "where" que usaremos para construir la query de prisma.
  if (category && category !== "all") where.category = category as string;          // Si envían "category" y no es "all", añadimos la condición de filtro por categoría a where
  if (search) where.name = { contains: search as string, mode: "insensitive" };     // Si envían búsqueda, añadimos a where la condición de filtro por nombre con el value de dicha busqueda
  if (minPrice || maxPrice) {                                                       // Si envían un rango de precios, añadimos a where la condición de filtro por precio
    where.price = {};
    if (minPrice) where.price.gte = Number(minPrice);
    if (maxPrice) where.price.lte = Number(maxPrice);
  }

  const orderBy: any = {};                                                          // Inicializamos un objeto "orderBy" que usaremos para construir la query de prisma.
  if (sort === "price-low") orderBy.price = "asc"                                   // Si envían "sort" y es "price-low", ordenamos por precio ascendente
  else if (sort === "price-high") orderBy.price = "desc"                            // Si envían "sort" y es "price-high", ordenamos por precio descendente
  else orderBy.createdAt = "desc"                                                   // Por defecto, ordenamos por fecha de creación descendente

  const products = await prisma.product.findMany({                                  // Usamos prisma para buscar los productos con las condiciones de "where" y "orderBy"
    where, orderBy
  });

  const productsWithDiscount = products.map((p: any) => {                           // Recorremos el array de productos para calcular el descuento de cada uno
    const discount = p.originalPrice && p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : 0;
    return { ...p, discount }                                                     // Devolvemos el producto con el descuento añadido
  });

  res.json({ products: productsWithDiscount });                                     // Devolvemos el array de productos con el descuento añadido 
}

// GET /api/products/:id
export const getProductsById = async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id as string }
  });

  if (!product) {
    res.status(404).json({ message: "Product not found" });
    return
  }

  const discount = product.originalPrice && product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  res.json({ product: { ...product, discount } })
}

// POST /api/products
export const createProduct = async (req: Request, res: Response) => {
  const product = await prisma.product.create({ data: req.body });
  res.status(201).json({ product })
};

// PUT /api/products/:id
export const updateProduct = async (req: Request, res: Response) => {
  const product = await prisma.product.update({
    where: { id: req.params.id as string },
    data: req.body
  });
  res.json({ product })
};

// DELETE /api/products/:id
export const deleteProduct = async (req: Request, res: Response) => {
  const product = await prisma.product.delete({
    where: { id: req.params.id as string }
  });
  res.json({ product })
};


