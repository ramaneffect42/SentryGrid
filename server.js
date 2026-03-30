require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sentrygrid';

const emergencyLogSchema = new mongoose.Schema(
  {
    id: {type: String, required: true, unique: true, index: true},
    senderId: {type: String, required: true, index: true},
    eventType: {type: String, enum: ['SOS', 'TEXT', 'RELAY'], required: true},
    message: {type: String, required: true},
    latitude: {type: Number, default: null},
    longitude: {type: Number, default: null},
    accuracy: {type: Number, default: null},
    altitude: {type: Number, default: null},
    hopCount: {type: Number, default: 0},
    maxHops: {type: Number, default: 5},
    transport: {type: String, required: true},
    route: {type: [String], default: []},
    syncStatus: {type: String, default: 'synced'},
    syncedAt: {type: Date, default: null},
    createdAt: {type: Date, required: true},
    updatedAt: {type: Date, required: true},
    metadata: {type: mongoose.Schema.Types.Mixed, default: {}},
  },
  {
    versionKey: false,
    collection: 'emergency_logs',
  },
);

const EmergencyLog = mongoose.model('EmergencyLog', emergencyLogSchema);

app.use(cors());
app.use(express.json({limit: '1mb'}));

app.get('/health', async (_request, response) => {
  const readyState = mongoose.connection.readyState;
  response.json({
    status: readyState === 1 ? 'ok' : 'degraded',
    mongoReadyState: readyState,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/sync', async (request, response) => {
  const logs = Array.isArray(request.body?.logs) ? request.body.logs : [];

  if (logs.length === 0) {
    return response.status(400).json({error: 'Request body must include a non-empty logs array'});
  }

  const syncedAt = new Date().toISOString();

  try {
    console.log('Received /api/sync payload');
    console.log(JSON.stringify(request.body, null, 2));

    const broadcastLogs = logs.filter(log => log?.metadata?.mode === 'broadcast');
    if (broadcastLogs.length > 0) {
      console.log('Broadcast logs received by /api/sync');
      console.log(JSON.stringify(broadcastLogs, null, 2));
    }

    const operations = logs.map(log => ({
      updateOne: {
        filter: {id: log.id},
        update: {
          $set: {
            senderId: log.senderId,
            eventType: log.eventType,
            message: log.message,
            latitude: log.latitude ?? null,
            longitude: log.longitude ?? null,
            accuracy: log.accuracy ?? null,
            altitude: log.altitude ?? null,
            hopCount: log.hopCount ?? 0,
            maxHops: log.maxHops ?? 5,
            transport: log.transport ?? 'mesh',
            route: Array.isArray(log.route) ? log.route : [],
            syncStatus: 'synced',
            syncedAt,
            createdAt: new Date(log.createdAt),
            updatedAt: new Date(log.updatedAt ?? syncedAt),
            metadata: log.metadata ?? {},
          },
        },
        upsert: true,
      },
    }));

    await EmergencyLog.bulkWrite(operations, {ordered: false});

    return response.status(200).json({
      syncedIds: logs.map(log => log.id),
      syncedAt,
      count: logs.length,
    });
  } catch (error) {
    return response.status(500).json({
      error: 'Failed to persist emergency logs',
      details: error.message,
    });
  }
});

const startServer = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`SentryGrid sync API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start SentryGrid backend', error);
    process.exit(1);
  }
};

if (require.main === module) {
  void startServer();
}

module.exports = {
  app,
  EmergencyLog,
  startServer,
};
