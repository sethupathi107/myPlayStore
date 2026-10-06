import Transport from "winston-transport";

export default class DbTransport extends Transport {
  constructor(opts, Logs) {
    super(opts);
    this.Logs = Logs;
    this.writing = false;
  }

  log(info, callback) {
    if (this.writing) {
      return callback();
    }

    this.writing = true;
    this.Logs.create({ message: info.message })
      .catch((err) => {
        console.error("DbTransport failed to write log:", err.message);
      })
      .finally(() => {
        this.writing = false;
      });

    callback();
  }
}