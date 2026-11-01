/**
 * Any version of a shared-layout fragment (share plan, eng D17). Its own tiny
 * module so the editor can recognise a link without loading the decoder,
 * which arrives only when a link is opened (LinkRoute is a lazy chunk).
 */
export const LINK_FRAGMENT = /^#v(\d+)\./;
