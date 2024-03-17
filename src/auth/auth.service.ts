import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import * as argon from "argon2"
import { AuthDto } from "./dto";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
@Injectable()
export class AuthService {
    constructor(private prisma:PrismaService,
    private jwt:JwtService,
    private config:ConfigService)
    {}
    
    async signup(dto:AuthDto){
        try{
            // generate password
            const hash = await argon.hash(dto.password);
     
            // save the new user
            const user = await this.prisma.user.create({data:{
                email:dto.email,
                password:hash
            },
        })
        return this.signToken(user.id,user.email);
        }catch(error){
            if(error instanceof PrismaClientKnownRequestError){
                if(error.code === "P2002"){
                    throw new ForbiddenException('Crentials taken')
                }
            }   
            throw error;
        }
    }
    async login(dto:AuthDto){
        // find the user by email
        const user = await this.prisma.user.findUnique({
            where:{
                email:dto.email
            }
        });

        // if user does not exits throw exception
        if(!user) throw new ForbiddenException('Credential incorrect');

        // compare password
        let pwMatches = await argon.verify(user.password,dto.password);
        
        // if password incorrect throw exception
        if(!pwMatches) throw new ForbiddenException('Credential incorrect');

        return this.signToken(user.id,user.email);
    }
    async signToken(userId:Number,email:String):Promise<{access_token:string}>{
        const payload = {
            sub:userId,
            email
        }
        const secert = this.config.get('JWT_SECERT');
        const token = await this.jwt.signAsync(payload,{
            expiresIn:'15m',
            secret:secert
        })
        return {access_token : token}
    }
}