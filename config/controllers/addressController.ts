

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

    res.status(201).json({ addresses })                                                                    // Se devuelve el array de direcciones.
}

// Update address
// PUT /api/addresses/:id