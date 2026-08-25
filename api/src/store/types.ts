export type User = {
  id: string;
  vkId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: string;
  isAdmin: boolean;
};

export type SavedGroup = {
  id: string;
  source: 'free' | 'bookmark' | 'favorite' | 'managed';
  vkGroupId: string;
  name: string;
  photo?: string;
  membersCount?: number;
};

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  body: string;
};

export type DataStore = {
  users: User[];
  sessions: Record<string, string>;
  groupsByUser: Record<string, SavedGroup[]>;
  news: NewsItem[];
};
