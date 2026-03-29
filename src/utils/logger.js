const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();

  if (meta === undefined) {
    return `[${timestamp}] [${level}] ${message}`;
  }

  return `[${timestamp}] [${level}] ${message} ${JSON.stringify(meta)}`;
};

const logger = {
  info(message, meta) {
    console.log(formatMessage('INFO', message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage('WARN', message, meta));
  },
  error(message, meta) {
    console.error(formatMessage('ERROR', message, meta));
  },
};

export default logger;
