import { Queue } from "bullmq";
import connection from "../utils/bullConnection.js";

const searchIndexQueue = new Queue("search-index", { connection });

export default searchIndexQueue;