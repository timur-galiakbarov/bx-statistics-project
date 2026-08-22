import { NewsModel } from '../models/News.js';
import { SavedGroupModel } from '../models/SavedGroup.js';
import { SessionModel } from '../models/Session.js';
import { UserModel } from '../models/User.js';
export function mapUser(user) {
    return {
        id: user._id.toString(),
        vkId: user.vkId,
        firstName: user.firstName,
        lastName: user.lastName,
        photo: user.photo,
        activeTo: user.activeTo.toISOString().slice(0, 10),
        isAdmin: user.isAdmin
    };
}
function mapGroup(group) {
    return {
        id: group._id.toString(),
        source: group.source,
        vkGroupId: group.vkGroupId,
        name: group.name,
        photo: group.photo ?? undefined,
        membersCount: group.membersCount ?? undefined
    };
}
export async function getUserBySession(sessionId) {
    const session = await SessionModel.findOne({
        token: sessionId ?? 'dev',
        expiresAt: { $gt: new Date() }
    })
        .populate('userId')
        .lean();
    if (!session?.userId) {
        return undefined;
    }
    return mapUser(session.userId);
}
export async function getGroups(userId, source) {
    const query = {
        userId,
        ...(source ? { source } : {})
    };
    const groups = await SavedGroupModel.find(query).sort({ createdAt: 1 }).lean();
    return groups.map(mapGroup);
}
export async function addGroup(userId, group) {
    const createdGroup = await SavedGroupModel.create({
        userId,
        source: group.source ?? 'free',
        vkGroupId: group.vkGroupId ?? String(group.name ?? 'unknown'),
        name: group.name ?? group.vkGroupId ?? 'Новая группа',
        photo: group.photo,
        membersCount: group.membersCount
    });
    return mapGroup(createdGroup);
}
export async function removeGroup(userId, groupId) {
    await SavedGroupModel.deleteOne({ _id: groupId, userId });
}
export async function getNews() {
    const news = await NewsModel.find({ isVisible: true }).sort({ publishedAt: -1 }).lean();
    return news.map((item) => ({
        id: item._id.toString(),
        title: item.title,
        date: item.publishedAt.toISOString().slice(0, 10),
        body: item.body
    }));
}
export async function getAdminStat(userId) {
    const [users, paidUsers, savedGroups] = await Promise.all([
        UserModel.countDocuments(),
        UserModel.countDocuments({ activeTo: { $gt: new Date() } }),
        SavedGroupModel.countDocuments({ userId })
    ]);
    return { users, paidUsers, savedGroups };
}
