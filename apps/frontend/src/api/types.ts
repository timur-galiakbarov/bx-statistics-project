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

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  body: string;
};
