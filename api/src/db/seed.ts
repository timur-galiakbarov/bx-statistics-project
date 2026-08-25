import { NewsModel } from '../models/News.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SessionModel } from '../models/Session.js';
import { UserModel } from '../models/User.js';

export async function seedDevelopmentData() {
  const existingUser = await UserModel.findOne({ vkId: '1' });

  const user =
    existingUser ??
    (await UserModel.create({
      vkId: '1',
      firstName: 'Demo',
      lastName: 'User',
      activeTo: new Date('2026-12-31T00:00:00.000Z'),
      isAdmin: true
    }));

  await SessionModel.updateOne(
    { token: 'dev' },
    {
      $setOnInsert: {
        userId: user._id,
        token: 'dev',
        expiresAt: new Date('2099-01-01T00:00:00.000Z')
      }
    },
    { upsert: true }
  );

  const groupsCount = await SavedGroupModel.countDocuments({ userId: user._id });
  if (groupsCount === 0) {
    await SavedGroupModel.insertMany([
      {
        userId: user._id,
        source: 'managed',
        vkGroupId: 'socstat_ru',
        name: 'socstat.ru',
        membersCount: 12840
      },
      {
        userId: user._id,
        source: 'free',
        vkGroupId: 'free-demo',
        name: 'Бесплатная группа',
        membersCount: 5420
      }
    ]);
  }

  const newsCount = await NewsModel.countDocuments();
  if (newsCount === 0) {
    await NewsModel.create({
      title: 'React/Node миграция начата',
      body: 'Это dev-данные нового API. Старые PHP endpoints можно переносить по одному.',
      publishedAt: new Date('2026-08-23T00:00:00.000Z'),
      isVisible: true
    });
  }
}
