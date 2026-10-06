import { Queue } from "bullmq";
import connection from "./bullConnection.js";

const mailQueue = new Queue("mail", { connection });

export default mailQueue;