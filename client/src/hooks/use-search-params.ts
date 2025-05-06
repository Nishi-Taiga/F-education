import { useLocation } from "wouter";

/**
 * URLの検索パラメータを取得するカスタムフック
 * wouter の useLocation を使用して現在のURLから検索パラメータを取得する
 * 
 * @returns URLSearchParams - 現在のURLの検索パラメータ
 */
export function useSearchParams(): URLSearchParams {
  const [location] = useLocation();
  return new URLSearchParams(location.split('?')[1] || '');
}