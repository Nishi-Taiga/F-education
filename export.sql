--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    student_id integer,
    tutor_id integer NOT NULL,
    tutor_shift_id integer NOT NULL,
    date text NOT NULL,
    time_slot text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'confirmed'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    report_status text DEFAULT 'pending'::text,
    report_content text
);


ALTER TABLE public.bookings OWNER TO neondb_owner;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bookings_id_seq OWNER TO neondb_owner;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: lesson_reports; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.lesson_reports (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    tutor_id integer NOT NULL,
    student_id integer,
    unit_content text NOT NULL,
    message_content text,
    goal_content text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    date text,
    time_slot text
);


ALTER TABLE public.lesson_reports OWNER TO neondb_owner;

--
-- Name: lesson_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.lesson_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lesson_reports_id_seq OWNER TO neondb_owner;

--
-- Name: lesson_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.lesson_reports_id_seq OWNED BY public.lesson_reports.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- Name: student_tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.student_tickets (
    id integer NOT NULL,
    student_id integer NOT NULL,
    user_id integer NOT NULL,
    quantity integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.student_tickets OWNER TO neondb_owner;

--
-- Name: student_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.student_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.student_tickets_id_seq OWNER TO neondb_owner;

--
-- Name: student_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.student_tickets_id_seq OWNED BY public.student_tickets.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.students (
    id integer NOT NULL,
    user_id integer NOT NULL,
    last_name text NOT NULL,
    first_name text NOT NULL,
    last_name_furigana text NOT NULL,
    first_name_furigana text NOT NULL,
    gender text NOT NULL,
    school text NOT NULL,
    grade text NOT NULL,
    birth_date text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    student_account_id integer
);


ALTER TABLE public.students OWNER TO neondb_owner;

--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.students_id_seq OWNER TO neondb_owner;

--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: tutor_shifts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tutor_shifts (
    id integer NOT NULL,
    tutor_id integer NOT NULL,
    date text NOT NULL,
    time_slot text NOT NULL,
    subject text NOT NULL,
    is_available boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tutor_shifts OWNER TO neondb_owner;

--
-- Name: tutor_shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tutor_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tutor_shifts_id_seq OWNER TO neondb_owner;

--
-- Name: tutor_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tutor_shifts_id_seq OWNED BY public.tutor_shifts.id;


--
-- Name: tutors; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tutors (
    id integer NOT NULL,
    user_id integer NOT NULL,
    last_name text NOT NULL,
    first_name text NOT NULL,
    last_name_furigana text NOT NULL,
    first_name_furigana text NOT NULL,
    university text NOT NULL,
    birth_date text NOT NULL,
    subjects text NOT NULL,
    bio text,
    is_active boolean DEFAULT true,
    profile_completed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    email text
);


ALTER TABLE public.tutors OWNER TO neondb_owner;

--
-- Name: tutors_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tutors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tutors_id_seq OWNER TO neondb_owner;

--
-- Name: tutors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tutors_id_seq OWNED BY public.tutors.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    display_name text,
    email text,
    phone text,
    postal_code text,
    prefecture text,
    city text,
    address text,
    profile_completed boolean DEFAULT false,
    tutor_profile_completed boolean DEFAULT false,
    email_notifications boolean DEFAULT true,
    sms_notifications boolean DEFAULT false,
    ticket_count integer DEFAULT 0 NOT NULL,
    role text DEFAULT 'user'::text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    student_id integer,
    parent_id integer
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: lesson_reports id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lesson_reports ALTER COLUMN id SET DEFAULT nextval('public.lesson_reports_id_seq'::regclass);


--
-- Name: student_tickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_tickets ALTER COLUMN id SET DEFAULT nextval('public.student_tickets_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Name: tutor_shifts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutor_shifts ALTER COLUMN id SET DEFAULT nextval('public.tutor_shifts_id_seq'::regclass);


--
-- Name: tutors id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutors ALTER COLUMN id SET DEFAULT nextval('public.tutors_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.bookings (id, user_id, student_id, tutor_id, tutor_shift_id, date, time_slot, subject, status, created_at, report_status, report_content) FROM stdin;
\.


--
-- Data for Name: lesson_reports; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.lesson_reports (id, booking_id, tutor_id, student_id, unit_content, message_content, goal_content, created_at, updated_at, date, time_slot) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
uC3VJ0Ds3a04edaW600rquCaeixHnPFv	{"cookie":{"originalMaxAge":86400000,"expires":"2025-05-10T01:52:07.516Z","secure":false,"httpOnly":true,"path":"/","sameSite":"lax"},"passport":{"user":13}}	2025-05-10 16:39:28
\.


--
-- Data for Name: student_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.student_tickets (id, student_id, user_id, quantity, created_at) FROM stdin;
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.students (id, user_id, last_name, first_name, last_name_furigana, first_name_furigana, gender, school, grade, birth_date, is_active, created_at, student_account_id) FROM stdin;
8	13	西	惟吹	にし	いぶき	男性	横浜高校	高校2年生	2006-08-15	t	2025-05-09 01:51:32.668242	\N
12	13	西	惟吹２	にし	いぶき２	男性	横浜小学	小学6年生	2016-02-09	t	2025-05-09 04:07:06.4455	\N
\.


--
-- Data for Name: tutor_shifts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tutor_shifts (id, tutor_id, date, time_slot, subject, is_available, created_at) FROM stdin;
\.


--
-- Data for Name: tutors; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tutors (id, user_id, last_name, first_name, last_name_furigana, first_name_furigana, university, birth_date, subjects, bio, is_active, profile_completed, created_at, email) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, display_name, email, phone, postal_code, prefecture, city, address, profile_completed, tutor_profile_completed, email_notifications, sms_notifications, ticket_count, role, created_at, student_id, parent_id) FROM stdin;
13	tai.nishi1998@gmail.com	3905f896e58a56f36a7251c82f8440d33b55f647daab2390c9e7a49fc1aa4dd638f9bf977bb5efb7fdf1344c80a2a7d9428608daf48fd45e1c04103278ccb80d.2602f5f09f9b2d60c92797b8361cbf48	西 泰我	tai.nishi1998@gmail.com	07090642214	1440035	東京都	大田区南蒲田	1-7-19-301	t	f	t	f	0	user	2025-05-09 01:50:19.036059	\N	\N
\.


--
-- Name: bookings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.bookings_id_seq', 1, false);


--
-- Name: lesson_reports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.lesson_reports_id_seq', 1, false);


--
-- Name: student_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.student_tickets_id_seq', 1, false);


--
-- Name: students_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.students_id_seq', 12, true);


--
-- Name: tutor_shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tutor_shifts_id_seq', 63, true);


--
-- Name: tutors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tutors_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 13, true);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: lesson_reports lesson_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lesson_reports
    ADD CONSTRAINT lesson_reports_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: student_tickets student_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_tickets
    ADD CONSTRAINT student_tickets_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: tutor_shifts tutor_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutor_shifts
    ADD CONSTRAINT tutor_shifts_pkey PRIMARY KEY (id);


--
-- Name: tutors tutors_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutors
    ADD CONSTRAINT tutors_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: bookings bookings_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: bookings bookings_tutor_id_tutors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_tutor_id_tutors_id_fk FOREIGN KEY (tutor_id) REFERENCES public.tutors(id);


--
-- Name: bookings bookings_tutor_shift_id_tutor_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_tutor_shift_id_tutor_shifts_id_fk FOREIGN KEY (tutor_shift_id) REFERENCES public.tutor_shifts(id);


--
-- Name: bookings bookings_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lesson_reports lesson_reports_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lesson_reports
    ADD CONSTRAINT lesson_reports_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: lesson_reports lesson_reports_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lesson_reports
    ADD CONSTRAINT lesson_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: lesson_reports lesson_reports_tutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.lesson_reports
    ADD CONSTRAINT lesson_reports_tutor_id_fkey FOREIGN KEY (tutor_id) REFERENCES public.tutors(id);


--
-- Name: student_tickets student_tickets_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_tickets
    ADD CONSTRAINT student_tickets_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id);


--
-- Name: student_tickets student_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.student_tickets
    ADD CONSTRAINT student_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: students students_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tutor_shifts tutor_shifts_tutor_id_tutors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutor_shifts
    ADD CONSTRAINT tutor_shifts_tutor_id_tutors_id_fk FOREIGN KEY (tutor_id) REFERENCES public.tutors(id);


--
-- Name: tutors tutors_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tutors
    ADD CONSTRAINT tutors_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

