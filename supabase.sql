-- 1. Supabase SQL Editor에서 전체 실행하세요.
-- 2. Authentication > Providers > Anonymous Sign-Ins 활성화가 필요합니다.
-- 3. 공개 배포 전 CAPTCHA/Turnstile, 프로젝트 사용량 제한, 개인정보 안내 점검이 필요합니다.
create table if not exists public.grade_entries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school text not null check (length(school) between 2 and 120),
  original_grade numeric(4,2) not null check (original_grade between 0 and 4.5),
  grade_scale numeric(2,1) not null check (grade_scale in (4.3,4.5)),
  normalized_grade numeric(4,2) generated always as (round((original_grade / grade_scale * 4.5)::numeric,2)) stored,
  updated_at timestamptz not null default now(),
  constraint grade_within_scale check(original_grade <= grade_scale)
);
create index if not exists grade_entries_school_idx on public.grade_entries(school);
alter table public.grade_entries enable row level security;
-- 개별 행은 Data API로 읽거나 수정할 수 없습니다. SECURITY DEFINER RPC만 사용합니다.
revoke all on public.grade_entries from anon, authenticated;

create or replace function public.save_my_grade(p_school text, p_grade numeric, p_scale numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if p_school is null or length(trim(p_school)) not between 2 and 120 then raise exception '학교가 올바르지 않습니다'; end if;
  if p_scale not in (4.3,4.5) or p_grade is null or p_grade<0 or p_grade>p_scale or p_grade<>round(p_grade,2) then
    raise exception '학점을 확인해 주세요';
  end if;
  insert into public.grade_entries(user_id,school,original_grade,grade_scale,updated_at)
  values(auth.uid(),trim(p_school),p_grade,p_scale,now())
  on conflict (user_id) do update set school=excluded.school,original_grade=excluded.original_grade,grade_scale=excluded.grade_scale,updated_at=now();
end; $$;

create or replace function public.delete_my_grade()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  delete from public.grade_entries where user_id=auth.uid();
end; $$;

-- 표본이 30명 이상일 때만 순위를 반환합니다. 원본 개별 학점은 노출하지 않습니다.
-- top_percent는 본인보다 높은 점수를 받은 사람 비율 기반의 대략적인 값입니다.
create or replace function public.get_grade_summary(p_scope text)
returns table(count bigint, average_grade numeric, top_percent numeric)
language plpgsql security definer set search_path = '' as $$
declare v_school text;v_grade numeric;v_count bigint;v_avg numeric;v_higher bigint;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if p_scope not in ('national','school') then raise exception '범위가 올바르지 않습니다'; end if;
  select e.school,e.normalized_grade into v_school,v_grade from public.grade_entries e where e.user_id=auth.uid();
  if not found then raise exception '학점 기록이 없습니다'; end if;
  select count(*),round(avg(e.normalized_grade)::numeric,2),count(*) filter(where e.normalized_grade>v_grade)
  into v_count,v_avg,v_higher from public.grade_entries e where p_scope='national' or e.school=v_school;
  if v_count<30 then return query select v_count,null::numeric,null::numeric;
  else return query select v_count,v_avg,round((100.0*v_higher/v_count)::numeric,1);
  end if;
end; $$;

revoke all on function public.save_my_grade(text,numeric,numeric) from public,anon;
revoke all on function public.delete_my_grade() from public,anon;
revoke all on function public.get_grade_summary(text) from public,anon;
grant execute on function public.save_my_grade(text,numeric,numeric) to authenticated;
grant execute on function public.delete_my_grade() to authenticated;
grant execute on function public.get_grade_summary(text) to authenticated;
