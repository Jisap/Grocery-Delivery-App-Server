import { Request, Response } from "express";
import { prisma } from "../prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const generateToken = (id: string) => {
    return jwt.sign({
        id,
        role: "delivery"
    },
        process.env.JWT_SECRET as string, { expiresIn: "30d" })
}


// Login Delivery Partner
// POST /api/delivery/login

export const loginPartner = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please provide email and password" })
    }

    const partner = await prisma.deliveryPartner.findUnique({
        where: {                  // busca en la tabla deliveryPartner por el email del partner (pasado a minuscula para evitar errores de capitalizacion)
            email: email.toLowerCase()
        }
    })

    if (!partner) {
        return res.status(401).json({ message: "Please provide email and password" })
    }

    if (!partner.isActive) {
        return res.status(403).json({ message: "Your account is not active" })
    }

    const isMatch = await bcrypt.compare(password, partner.password);                 // compara la contraseña en texto plano con el hash en la bd
    if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" })
    }

    const token = generateToken(partner.id);                                          // genera el token
    const { password: _, ...partnerData } = partner                                     // spread operator para extraer el password y guardar el resto en partnerData

    res.json({ ...partnerData, token })                                               // devuelve el partnerData con el nuevo token


}