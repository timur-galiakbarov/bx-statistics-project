import { Schema, model } from 'mongoose';

// Один документ — состояние канала/сообщества на конкретный день (по Москве).
// История подписчиков не восстанавливается задним числом, поэтому срезы
// копятся ежедневно планировщиком snapshotScheduler.
const channelSnapshotSchema = new Schema(
  {
    platform: { type: String, enum: ['vk', 'youtube', 'telegram'], required: true },
    externalId: { type: String, required: true },
    date: { type: String, required: true },
    title: { type: String },
    subscribers: { type: Number, default: null },
    // Только YouTube: накопительные счётчики канала.
    totalViews: { type: Number },
    videoCount: { type: Number },
    // Только VK: подписчики и посты снимаются разными запросами. false — посты
    // ещё не собраны, следующий проход повторит wall.get (не больше
    // SNAPSHOT_POST_MAX_ATTEMPTS раз за день).
    postsCollected: { type: Boolean },
    postsAttempts: { type: Number }
  },
  { timestamps: true }
);

channelSnapshotSchema.index({ platform: 1, externalId: 1, date: 1 }, { unique: true });
channelSnapshotSchema.index({ date: 1 });

export const ChannelSnapshotModel = model('ChannelSnapshot', channelSnapshotSchema);
