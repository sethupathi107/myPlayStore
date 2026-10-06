import { Queue } from "bullmq";
import connection from "./bullConnection.js";

// One queue, two kinds of jobs distinguished by job name:
//   "export"          - build one export file (see exportWorker.js)
//   "cleanup-exports"  - a repeatable job (registered in exportWorker.js)
//                        that deletes export files older than N days
const exportQueue = new Queue("export", { connection });

export default exportQueue;
