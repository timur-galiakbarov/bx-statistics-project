export type User = {
  id: string;
  vkId: string;
  firstName: string;
  lastName: string;
  photo?: string;
  activeTo: string;
  isAdmin: boolean;
};

export type SocialPlatform = 'vk' | 'youtube';

export type SocialChannel = {
  platform: SocialPlatform;
  externalId: string;
  name: string;
  handle?: string;
  url: string;
  photo?: string;
  followersCount?: number | null;
};

export type SavedGroup = SocialChannel & {
  id: string;
  source: 'free' | 'bonus' | 'bookmark' | 'favorite' | 'managed';
  isTracked: boolean;
  vkGroupId: string;
  membersCount?: number | null;
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
