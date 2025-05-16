import { useLocation } from "wouter";

// URLのクエリパラメータを取得するカスタムフック
export function useSearchParams(): URLSearchParams {
  const [location] = useLocation();
  
  // 現在のURLからSearchParamsを生成
  // 例: /products?page=1&sort=name からは 'page=1&sort=name' の部分を取得
  const search = window.location.search;
  
  return new URLSearchParams(search);
}