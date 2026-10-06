    import { Worker } from "bullmq";
    import connection from "./bullConnection.js";
    import transporter from "./mailer.js";
    import logger from "./logger.js";

    const mailWorker = new Worker(
        "mail",
        async (job)=>{
            const {to,subject,text}=job.data;
            const info = await transporter.sendMail({
                from: `"PlayStore Clone" <${process.env.GMAIL_USER}>`,
                to,
                subject,
                text,
            });
            logger.info(`Email send to ${to}, messageId: ${info.messageId}`)
        },
        {   connection,
            concurrency: 5,
            limiter: {
                max: 10,
                duration: 1000,
            },
        }
    );

    mailWorker.on("failed",(job,err)=>{
        logger.error(`Mail job ${job.id} failed: ${err.message}`)
    });
    export default mailWorker;