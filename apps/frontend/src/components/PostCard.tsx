import {
  Activity,
  BarChart3,
  Eye,
  ExternalLink,
  Heart,
  Image,
  MessageCircle,
  Play,
  Repeat2
} from 'lucide-react';
import type { CommunityAnalytics } from '../api/types';

type PostMedia = {
  type: 'photo' | 'video' | 'gif';
  url: string;
  title: string;
};

export type PostCardData = {
  id: string | number;
  group: CommunityAnalytics['group'];
  date: string;
  text: string;
  url: string;
  media: PostMedia[];
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  er: number;
  isAd: boolean;
};

type Props = {
  post: PostCardData;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function getPostPreview(post: PostCardData) {
  return post.media[0];
}

export function PostCard({ post }: Props) {
  const preview = getPostPreview(post);

  return (
    <article className="post-card">
      <div className="post-card-media">
        {preview ? (
          <>
            <img src={preview.url} alt="" />
            {preview.type !== 'photo' && (
              <span className="post-media-kind">
                {preview.type === 'video' ? <Play size={15} /> : <Image size={15} />}
                {preview.type === 'video' ? 'Видео' : 'GIF'}
              </span>
            )}
            {post.media.length > 1 && <span className="post-media-count">+{post.media.length - 1}</span>}
          </>
        ) : (
          <div className="post-card-media-empty">
            <BarChart3 size={26} />
          </div>
        )}
      </div>

      <div className="post-card-body">
        <div className="post-card-header">
          <span className="post-group-mini">
            {post.group.photo && <img src={post.group.photo} alt="" />}
            <span>
              <strong>{post.group.name}</strong>
              <small>{new Date(post.date).toLocaleString('ru-RU')}</small>
            </span>
          </span>
          <a className="icon-button" href={post.url} rel="noreferrer" target="_blank" aria-label="Открыть пост VK">
            <ExternalLink size={17} />
          </a>
        </div>

        <p>{post.text || 'Без текста'}</p>

        <div className="post-metrics">
          <span title="Лайки" aria-label={`Лайки: ${formatNumber(post.likes)}`}>
            <Heart size={15} />
            {formatNumber(post.likes)}
          </span>
          <span title="Репосты" aria-label={`Репосты: ${formatNumber(post.reposts)}`}>
            <Repeat2 size={15} />
            {formatNumber(post.reposts)}
          </span>
          <span title="Комментарии" aria-label={`Комментарии: ${formatNumber(post.comments)}`}>
            <MessageCircle size={15} />
            {formatNumber(post.comments)}
          </span>
          <span title="Просмотры" aria-label={`Просмотры: ${formatNumber(post.views)}`}>
            <Eye size={15} />
            {formatNumber(post.views)}
          </span>
          <span title="ER" aria-label={`ER: ${post.er}%`}>
            <Activity size={15} />
            {post.er}%
          </span>
          {post.isAd && <span>Реклама</span>}
        </div>
      </div>
    </article>
  );
}
