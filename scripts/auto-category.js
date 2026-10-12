'use strict';

// 按文件夹路径自动生成【嵌套】分类
//   source/_posts/题解/CCPC/xxx.md   ->   categories: [[题解, CCPC]]   （题解 › CCPC）
//   放在 source/_posts/ 根目录的文章不受影响。
// 开关：_config.yml 里的 auto_category.enable

const front = require('hexo-front-matter');
const fs = require('hexo-fs');

hexo.extend.filter.register('before_post_render', function (data) {
  const cfg = this.config.auto_category;
  if (!cfg || cfg.enable === false) return data;
  if (data.layout !== 'post') return data;
  if (!this.config.render_drafts && data.source.startsWith('_drafts/')) return data;

  const parts = data.source.split('/');
  const folders = parts.slice(1, -1);
  if (folders.length === 0) return data;

  const parsed = front.parse(data.raw);
  if (JSON.stringify(parsed.categories) === JSON.stringify([folders])) return data;

  parsed.categories = [folders];
  fs.writeFileSync(data.full_source, '---\n' + front.stringify(parsed), 'utf-8');
  this.log.i('auto-category: %s  ->  %s', folders.join(' > '), parts[parts.length - 1]);
  return data;
}, 15);
