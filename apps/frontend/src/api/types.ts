export type User = {
  id?: string;
  vkId?: string;
  first_name: string;
  last_name: string;
  userFullName: string;
  photo_200?: string;
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

export type VkGroup = {
  id: number;
  name: string;
  screen_name?: string;
  photo_50?: string;
  photo_100?: string;
  photo_200?: string;
  members_count?: number;
};

export type VkListResponse<T> = {
  count: number;
  items: T[];
};

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  body: string;
};
