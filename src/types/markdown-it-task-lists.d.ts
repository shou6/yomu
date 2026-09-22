// markdown-it-task-lists は型定義を配っていないので、使う範囲だけをここで宣言する
declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';

  interface TaskListsOptions {
    /** チェックボックスを操作できるようにする。既定は false */
    enabled?: boolean;
    /** チェックボックスを label で包む。既定は false */
    label?: boolean;
    /** label を後ろに置く。既定は false */
    labelAfter?: boolean;
  }

  const taskLists: (md: MarkdownIt.MarkdownIt, options?: TaskListsOptions) => void;
  export default taskLists;
}
