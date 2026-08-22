import dotenv from 'dotenv';
dotenv.config();
export const env = {
    port: Number(process.env.PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    sessionCookie: process.env.SESSION_COOKIE ?? 'socstat_session',
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/socstat',
    vkClientId: process.env.VK_CLIENT_ID ?? '5358505'
};
