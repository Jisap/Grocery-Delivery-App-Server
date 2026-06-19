

// Get user addresses
// GET /api/addresses

import { Request, Response } from "express";
import { prisma } from "../prisma.js"

export const getAddresses = async (req: Request, res: Response) => {
	const addresses = await prisma.address.findMany({
		where: { userId: req.user!.id },                                   // Se filtran solo las direcciones del usuario autenticado.
		orderBy: { createdAt: "asc" }                                      // Se ordenan por fecha de creación ascendente para que la más antigua aparezca primero.
	});
	res.json(addresses);
}


// Add address
// POST /api/addresses

export const addAddress = async (req: Request, res: Response) => {
	const { label, address, city, state, zip, isDefault, lat, lng } = req.body;                               // Se extraen los datos del body de la solicitud.

	//Require coordinates
	if (lat === null || lng === null) {
		return res.status(400).json({ message: "Coordinates are required, Please allow location access" })
	}

	const currentAddresses = await prisma.address.findMany({                                                 // Se buscan las direcciones existentes del usuario.
		where: { userId: req.user!.id }
	})

	let makeDefault = isDefault;                                                                             // Se inicializa la variable makeDefault con el valor de isDefault.
	if (currentAddresses.length === 0) makeDefault = true;                                                    // Si no hay direcciones existentes, se establece makeDefault en true.

	if (makeDefault) {                                                                                         // Si makeDefault es true, se actualizan todas las direcciones existentes para establecerlas como no predeterminadas.
		await prisma.address.updateMany({
			where: { userId: req.user!.id },
			data: { isDefault: false }
		})
	}

	await prisma.address.create({                                                                            // Se crea un nuevo registro de dirección con los datos proporcionados.
		data: {
			userId: req.user!.id,
			label,
			address,
			city,
			state,
			zip,
			isDefault: makeDefault,
			lat: Number(lat),
			lng: Number(lng)
		}
	})

	const addresses = await prisma.address.findMany({                                                    // Se buscan todas las direcciones del usuario autenticado.
		where: { userId: req.user!.id },
		orderBy: { createdAt: "asc" }                                                                      // Se ordenan por fecha de creación ascendente para que la más antigua aparezca primero.
	})

	res.status(201).json({ addresses })                                                                  // Se devuelve el array de direcciones.
}

// Update address
// PUT /api/addresses/:id
export const updateAddress = async (req: Request, res: Response) => {
	const { label, address, city, state, zip, isDefault, lat, lng } = req.body;                                   // Se extraen los datos del body de la solicitud.

	//Require coordinates
	if (lat === null || lng === null) {
		return res.status(400).json({ message: "Coordinates are required, Please allow location access" })
	}

	if (isDefault) {                                                                                              // Si se marca isDefault como true, se actualizan todas las direcciones del usuario para que ninguna sea predeterminada.
		await prisma.address.updateMany({
			where: { userId: req.user!.id },
			data: { isDefault: false }
		})
	}

	const data: any = {};                                                                                         // Se crea un objeto vacío para almacenar los datos a actualizar.
	if (label) data.label = label                                                                                 // Si label existe, se agrega al objeto data.
	if (address) data.address = address                                                                           // Si address existe, se agrega al objeto data.
	if (city) data.city = city                                                                                    // Si city existe, se agrega al objeto data.
	if (state) data.state = state                                                                                 // Si state existe, se agrega al objeto data.
	if (zip) data.zip = zip                                                                                       // Si zip existe, se agrega al objeto data.
	if (isDefault !== undefined) data.isDefault = isDefault                                                       // Si isDefault existe, se agrega al objeto data.
	if (lat !== null) data.lat = Number(lat)                                                                      // Si lat existe, se agrega al objeto data.
	if (lng !== null) data.lng = Number(lng)                                                                      // Si lng existe, se agrega al objeto data.

	try {
		await prisma.address.update({
			where: { id: req.params.id as string },                                                                   // Se actualiza la dirección con la data recibida para el id proporcionado.
			data
		})
	} catch (error) {
		return res.status(404).json({ message: "Address not found" })
	}

	const addresses = await prisma.address.findMany({                                                            // Se buscan todas las direcciones (actualizadas) del usuario autenticado.
		where: { userId: req.user!.id },
		orderBy: { createdAt: "asc" }                                                                              // Se ordenan por fecha de creación ascendente para que la más antigua aparezca primero.
	})

	res.json({
		addresses
	})
}

// Delete address
// DELETE /api/addresses/:id

export const deleteAddress = async (req: Request, res: Response) => {
	try {
		await prisma.address.delete({
			where: { id: req.params.id as string }
		})
	} catch (error: any) {
		console.log(error.message)
	}

	const addresses = await prisma.address.findMany({                                                            // Se buscan todas las direcciones (actualizadas) del usuario autenticado.
		where: { userId: req.user!.id },
		orderBy: { createdAt: "asc" }                                                                              // Se ordenan por fecha de creación ascendente para que la más antigua aparezca primero.
	})

	res.json({
		addresses
	})
}