import { Page } from '../api';
import PageTreeNode from './PageTreeNode';

interface PageTreeProps {
  pages: Page[];
  depth?: number;
}

export default function PageTree({ pages, depth = 0 }: PageTreeProps) {
  return (
    <div>
      {pages.map((page) => (
        <PageTreeNode key={page.id} page={page} depth={depth} />
      ))}
    </div>
  );
}