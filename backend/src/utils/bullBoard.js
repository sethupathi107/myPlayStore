import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import mailQueue from "./mailQueue.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/queues");

createBullBoard({
    queues: [new BullMQAdapter(mailQueue)],
    serverAdapter,
});

export default serverAdapter;