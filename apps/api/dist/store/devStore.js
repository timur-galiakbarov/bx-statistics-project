import { nanoid } from 'nanoid';
const demoUser = {
    id: 'user-demo',
    vkId: '1',
    firstName: 'Demo',
    lastName: 'User',
    activeTo: '2026-12-31',
    isAdmin: true
};
const store = {
    users: [demoUser],
    sessions: {
        dev: demoUser.id
    },
    groupsByUser: {
        [demoUser.id]: [
            {
                id: 'group-socstat',
                source: 'managed',
                vkGroupId: 'socstat_ru',
                name: 'socstat.ru',
                membersCount: 12840
            },
            {
                id: 'group-free',
                source: 'free',
                vkGroupId: 'free-demo',
                name: 'Бесплатная группа',
                membersCount: 5420
            }
        ]
    },
    news: [
        {
            id: 'migration-start',
            title: 'React/Node миграция начата',
            date: '2026-08-23',
            body: 'Это dev-данные нового API. Старые PHP endpoints можно переносить по одному.'
        }
    ]
};
export function getUserBySession(sessionId) {
    const userId = sessionId ? store.sessions[sessionId] : store.sessions.dev;
    return store.users.find((user) => user.id === userId);
}
export function getGroups(userId, source) {
    const groups = store.groupsByUser[userId] ?? [];
    return source ? groups.filter((group) => group.source === source) : groups;
}
export function addGroup(userId, group) {
    const nextGroup = {
        id: nanoid(),
        source: group.source ?? 'free',
        vkGroupId: group.vkGroupId ?? String(group.name ?? 'unknown'),
        name: group.name ?? group.vkGroupId ?? 'Новая группа',
        photo: group.photo,
        membersCount: group.membersCount
    };
    store.groupsByUser[userId] = [...(store.groupsByUser[userId] ?? []), nextGroup];
    return nextGroup;
}
export function removeGroup(userId, groupId) {
    const groups = store.groupsByUser[userId] ?? [];
    store.groupsByUser[userId] = groups.filter((group) => group.id !== groupId);
}
export function getNews() {
    return store.news;
}
