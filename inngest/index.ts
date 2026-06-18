import { cron, Inngest } from "inngest";
import { prisma } from "../config/prisma.js";
import sendEmail from "../config/nodemailer.js";
import { monthlyOffersTemplate } from "../templates/Monthlyoffers.js";
import { lowStockAlertTemplate } from "../templates/Lowstockalert.js";

const LOW_STOCK_THRESHOLD = 10;

// Create a client to send and receive events
export const inngest = new Inngest({ id: "grocery-delivery" });

// Low Stock Alert to Admin Email
const checkLowStock = inngest.createFunction(
	{
		id: "check-low-stock",
		name: "Low Stock Alert",
		triggers: [{ event: "inventory/stock.updated" }]
	},
	async ({ event, step }) => {
		const { productId } = event.data;

		const product = await step.run("fetch-product", async () => {
			return await prisma.product.findUnique({
				where: { id: productId }
			})
		})
		if (!product || product.stock === null || product.stock >= LOW_STOCK_THRESHOLD) {
			return { skipped: true, stock: product?.stock }
		}

		await step.run("send-low-stock-email", async () => {
			const adminEmails = process.env.ADMIN_EMAILS
				? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim())
				: [];

			if (adminEmails.length === 0) return { skipped: true, reason: "No admin emails" }

			await sendEmail({
				to: adminEmails.join(","),
				subject: `Low Stock Alert: "${product.name}`,
				body: lowStockAlertTemplate(product),
			})
		})

		return {
			alerted: true,
			product: product.name,
			stock: product.stock
		}
	},
);

// Monthly Offers Email (1st of every month - payday)
const sendMonthlyOffers = inngest.createFunction({
	id: "send-monthly-offers",
	name: "Monthly Payday Offers",
	triggers: [cron("0 10 1 * *")]                                                         // El día 1 de cada mes a las 10:00. Inngest se encarga de "despertar" la función automáticamente sin que nadie tenga que llamarla.
}, async ({ step }) => {
	const { deals, users } = await step.run("fetch-deals-and-users", async () => {
		// Get top discounted products as featured deals
		const products = await prisma.product.findMany({                                     // Coge los 6 productos con stock disponible ordenados por precio original descendente
			where: { stock: { gt: 0 } },
			take: 6,
			orderBy: { originalPrice: "desc" },
		})

		const allUsers = await prisma.user.findMany({ select: { email: true, name: true } })  // Obtiene el email y nombre de todos los usuarios.

		return {
			deals: products,
			users: allUsers
		}
	})

	if (users.length === 0 || deals.length === 0) {                                         // Simplemente evita seguir si no hay usuarios o no hay productos con stock
		return { skipped: true, reason: "No users or deals found" }
	}

	let sentCount = 0;

	// Se envian por lotes de 10 para no saturar el servidor de correo. Cada lote es un step.
	const batchSize = 10;
	for (let i = 0; i < users.length; i += batchSize) {
		const batch = users.slice(i, i + batchSize)

		await step.run(`send-offers-batch-${i / batchSize + 1}`, async () => { // Cada lote - step tendrá un nombre dinámico
			for (const u of batch) {
				await sendEmail({
					to: u.email,
					subject: `Fresh Picks Just For You!`,
					body: monthlyOffersTemplate({
						userName: u.name,
						deals,
						shopUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/products`,
					}),
				})
			}
		})
		sentCount += batch.length;
	}

	return {
		sent: sentCount
	}
})


// Create an empty array where we'll export future Inngest functions
export const functions = [checkLowStock, sendMonthlyOffers];