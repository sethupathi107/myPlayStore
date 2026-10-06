import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import multer from "multer";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

const storage = multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,UPLOAD_DIR)
    },
    filename:(req,file,cb)=>{
        const ext = path.extname(file.originalname);
        const name = `${crypto.randomUUID()}${ext}`;
        cb(null,name)
    }
})

const upload = multer({
    storage,
    limits:{
        fileSize:5*1024*1024,
    }
})

export default upload;