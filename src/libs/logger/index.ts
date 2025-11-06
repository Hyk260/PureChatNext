import Pino from 'pino';
import pretty from 'pino-pretty';

export const pino = Pino({
  level: process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info',
});

const prettyStream = pretty({
  colorize: true,
  crlf: true,
  // messageFormat: '{msg}' 
});

export const logger = Pino(prettyStream);