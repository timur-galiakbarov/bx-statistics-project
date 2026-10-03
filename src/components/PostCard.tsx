import {
  Activity,
  BarChart3,
  Eye,
  ExternalLink,
  FileText,
  Forward,
  Heart,
  Image,
  MessageCircle,
  Play,
  Repeat2,
  SmilePlus
} from 'lucide-react';
import type { CommunityAnalytics } from '../api/types';

type PostMedia = {
  type: 'photo' | 'video' | 'gif' | 'document' | 'poll' | 'other';
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
  likes: number | null;
  reposts: number | null;
  comments: number | null;
  views: number | null;
  er: number | null;
  isAd: boolean;
  contentType?: string;
  resultBadge?: string;
  resultReason?: string;
};

type Props = {
  post: PostCardData;
};

function formatNumber(value: number | null) {
  return value === null ? 'Недоступно' : new Intl.NumberFormat('ru-RU').format(value);
}

function getPostPreview(post: PostCardData) {
  return post.media[0];
}

export function PostCard({ post }: Props) {
  const preview = getPostPreview(post);
  const isTelegram = post.group.platform === 'telegram';
  const PreviewIcon = preview?.type === 'video' ? Play : preview?.type === 'document' ? FileText : Image;

  return (
    <article className={`post-card ${isTelegram ? 'telegram-post-card' : ''}`}>
      <div className={`post-card-media ${isTelegram ? 'telegram-post-card-media' : ''}`}>
        {preview ? (
          <>
            {preview.url ? <img src={preview.url} alt="" /> : <div className="post-card-media-empty"><PreviewIcon size={34} /></div>}
            {preview.type !== 'photo' && (
              <span className="post-media-kind">
                <PreviewIcon size={15} />
                {preview.title}
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
          <a className="icon-button" href={post.url} rel="noreferrer" target="_blank" aria-label="Открыть публикацию">
            <ExternalLink size={17} />
          </a>
        </div>

        <div className="post-card-tags">
          <span>{post.contentType ?? (preview ? preview.title : 'Текст')}</span>
          {isTelegram
            ? <span className="telegram-public-badge">Публичные данные</span>
            : post.group.platform !== 'youtube' && <span className={post.isAd ? 'post-ad-badge' : 'post-organic-badge'}>{post.isAd ? 'Реклама' : 'Органический'}</span>}
          {post.resultBadge && <strong className="post-result-badge">{post.resultBadge}</strong>}
        </div>

        <p>{post.text || 'Без текста'}</p>

        {post.resultReason && <small className="post-result-reason">{post.resultReason}</small>}

        <div className="post-metrics">
          <span title={isTelegram ? 'Реакции' : 'Лайки'} aria-label={`${isTelegram ? 'Реакции' : 'Лайки'}: ${formatNumber(post.likes)}`}>
            {isTelegram ? <SmilePlus size={15} /> : <Heart size={15} />}
            {formatNumber(post.likes)}
          </span>
          {post.group.platform !== 'youtube' && <span title={isTelegram ? 'Пересылки' : 'Репосты'} aria-label={`${isTelegram ? 'Пересылки' : 'Репосты'}: ${formatNumber(post.reposts)}`}>
            {isTelegram ? <Forward size={15} /> : <Repeat2 size={15} />}
            {formatNumber(post.reposts)}
          </span>}
          <span title="Комментарии" aria-label={`Комментарии: ${formatNumber(post.comments)}`}>
            <MessageCircle size={15} />
            {formatNumber(post.comments)}
          </span>
          <span title="Просмотры" aria-label={`Просмотры: ${formatNumber(post.views)}`}>
            <Eye size={15} />
            {formatNumber(post.views)}
          </span>
          <span title={post.group.platform === 'youtube' || isTelegram ? 'Вовлечённость по просмотрам' : 'ER'} aria-label={`Вовлечённость: ${post.er === null ? 'недоступно' : formatEr(post.er)}`}>
            <Activity size={15} />
            {post.er === null ? 'Недоступно' : formatEr(post.er)}
          </span>
        </div>
      </div>
    </article>
  );
}

function formatEr(value: number) {
  // Маленький ER (доли процента у больших сообществ) показываем с тремя знаками, чтобы не превращать его в 0%.
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: Math.abs(value) < 1 ? 3 : 2 }).format(value)}%`;
}
