--
-- PostgreSQL database dump
--

\restrict K36viiCEfLgn8jOI3pbEGzXLSywiZe1ehscOacwncA8K5U77EspEeV6s0RnmVlu

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

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
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO precast;

--
-- Name: dispatch_items; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.dispatch_items (
    id integer NOT NULL,
    dispatch_id integer,
    yard_inventory_id integer,
    quantity integer NOT NULL
);


ALTER TABLE public.dispatch_items OWNER TO precast;

--
-- Name: dispatch_items_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.dispatch_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_items_id_seq OWNER TO precast;

--
-- Name: dispatch_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.dispatch_items_id_seq OWNED BY public.dispatch_items.id;


--
-- Name: dispatch_orders; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.dispatch_orders (
    id integer NOT NULL,
    factory_id integer,
    project_id integer,
    dispatch_date date NOT NULL,
    truck_number character varying(50),
    status character varying(50),
    status_changed_at timestamp without time zone,
    status_changed_by integer
);


ALTER TABLE public.dispatch_orders OWNER TO precast;

--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.dispatch_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispatch_orders_id_seq OWNER TO precast;

--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.dispatch_orders_id_seq OWNED BY public.dispatch_orders.id;


--
-- Name: element_moulds; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.element_moulds (
    id integer NOT NULL,
    element_id integer NOT NULL,
    mould_id integer NOT NULL
);


ALTER TABLE public.element_moulds OWNER TO precast;

--
-- Name: element_moulds_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.element_moulds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.element_moulds_id_seq OWNER TO precast;

--
-- Name: element_moulds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.element_moulds_id_seq OWNED BY public.element_moulds.id;


--
-- Name: elements; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.elements (
    id integer NOT NULL,
    factory_id integer,
    project_id integer NOT NULL,
    mix_design_id integer,
    element_type character varying(50) NOT NULL,
    element_mark character varying(50) NOT NULL,
    quantity integer NOT NULL,
    volume numeric(10,2),
    due_date date,
    concrete_strength_mpa integer,
    requires_cubes boolean NOT NULL,
    panel_length_mm integer,
    slab_thickness_mm integer,
    active boolean NOT NULL,
    status character varying(50) NOT NULL
);


ALTER TABLE public.elements OWNER TO precast;

--
-- Name: elements_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.elements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.elements_id_seq OWNER TO precast;

--
-- Name: elements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.elements_id_seq OWNED BY public.elements.id;


--
-- Name: factories; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.factories (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    is_active boolean NOT NULL
);


ALTER TABLE public.factories OWNER TO precast;

--
-- Name: factories_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.factories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.factories_id_seq OWNER TO precast;

--
-- Name: factories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.factories_id_seq OWNED BY public.factories.id;


--
-- Name: hollowcore_beds; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.hollowcore_beds (
    id integer NOT NULL,
    factory_id integer,
    name character varying(120) NOT NULL,
    length_mm integer NOT NULL,
    max_casts_per_day integer NOT NULL,
    active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.hollowcore_beds OWNER TO precast;

--
-- Name: hollowcore_beds_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.hollowcore_beds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hollowcore_beds_id_seq OWNER TO precast;

--
-- Name: hollowcore_beds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.hollowcore_beds_id_seq OWNED BY public.hollowcore_beds.id;


--
-- Name: hollowcore_casts; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.hollowcore_casts (
    id integer NOT NULL,
    factory_id integer,
    element_id integer NOT NULL,
    cast_date date NOT NULL,
    bed_number integer,
    bed_id integer,
    cast_slot_index integer NOT NULL,
    slab_thickness_mm integer NOT NULL,
    panel_length_mm integer NOT NULL,
    quantity integer NOT NULL,
    used_length_mm integer,
    waste_mm integer,
    batch_id character varying(50),
    status character varying(50) DEFAULT 'planned'::character varying NOT NULL,
    created_by integer,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.hollowcore_casts OWNER TO precast;

--
-- Name: hollowcore_casts_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.hollowcore_casts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hollowcore_casts_id_seq OWNER TO precast;

--
-- Name: hollowcore_casts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.hollowcore_casts_id_seq OWNED BY public.hollowcore_casts.id;


--
-- Name: hollowcore_settings; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.hollowcore_settings (
    id integer NOT NULL,
    factory_id integer,
    bed_count integer NOT NULL,
    bed_length_mm integer NOT NULL,
    waste_margin_mm integer NOT NULL,
    casts_per_bed_per_day integer NOT NULL,
    default_waste_mm integer,
    default_casts_per_day integer,
    active boolean NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    cutting_strength_mpa integer,
    final_strength_mpa integer
);


ALTER TABLE public.hollowcore_settings OWNER TO precast;

--
-- Name: hollowcore_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.hollowcore_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hollowcore_settings_id_seq OWNER TO precast;

--
-- Name: hollowcore_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.hollowcore_settings_id_seq OWNED BY public.hollowcore_settings.id;


--
-- Name: mix_designs; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.mix_designs (
    id integer NOT NULL,
    name character varying(120) NOT NULL,
    target_strength_mpa integer,
    active boolean NOT NULL,
    factory_id integer
);


ALTER TABLE public.mix_designs OWNER TO precast;

--
-- Name: mix_designs_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.mix_designs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mix_designs_id_seq OWNER TO precast;

--
-- Name: mix_designs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.mix_designs_id_seq OWNED BY public.mix_designs.id;


--
-- Name: moulds; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.moulds (
    id integer NOT NULL,
    factory_id integer,
    name character varying(255) NOT NULL,
    mould_type character varying(100) NOT NULL,
    capacity integer NOT NULL,
    cycle_time_hours numeric(5,2) NOT NULL,
    active boolean NOT NULL
);


ALTER TABLE public.moulds OWNER TO precast;

--
-- Name: moulds_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.moulds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.moulds_id_seq OWNER TO precast;

--
-- Name: moulds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.moulds_id_seq OWNED BY public.moulds.id;


--
-- Name: planner_delays; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.planner_delays (
    id integer NOT NULL,
    factory_id integer,
    planner_type character varying(32) NOT NULL,
    delay_date date NOT NULL,
    mould_id integer,
    bed_id integer,
    lost_capacity integer NOT NULL,
    reason character varying(255),
    created_by integer,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.planner_delays OWNER TO precast;

--
-- Name: planner_delays_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.planner_delays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.planner_delays_id_seq OWNER TO precast;

--
-- Name: planner_delays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.planner_delays_id_seq OWNED BY public.planner_delays.id;


--
-- Name: production_schedule; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.production_schedule (
    id integer NOT NULL,
    factory_id integer,
    element_id integer NOT NULL,
    mould_id integer NOT NULL,
    production_date date NOT NULL,
    quantity integer NOT NULL,
    batch_id character varying(50),
    status character varying(50) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.production_schedule OWNER TO precast;

--
-- Name: production_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.production_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.production_schedule_id_seq OWNER TO precast;

--
-- Name: production_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.production_schedule_id_seq OWNED BY public.production_schedule.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    factory_id integer,
    project_name character varying(255) NOT NULL,
    client character varying(255),
    start_date date,
    due_date date,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    work_saturday boolean NOT NULL,
    work_sunday boolean NOT NULL,
    status_reason character varying(500),
    status_changed_at timestamp without time zone,
    closed_at date
);


ALTER TABLE public.projects OWNER TO precast;

--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.projects_id_seq OWNER TO precast;

--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: quality_tests; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.quality_tests (
    id integer NOT NULL,
    element_id integer NOT NULL,
    batch_id character varying(50),
    mix_design_id integer,
    test_type character varying(100) NOT NULL,
    result character varying(50) NOT NULL,
    age_days integer,
    cube1_weight_kg double precision,
    cube1_strength_mpa double precision,
    cube2_weight_kg double precision,
    cube2_strength_mpa double precision,
    cube3_weight_kg double precision,
    cube3_strength_mpa double precision,
    avg_strength_mpa double precision,
    measured_strength_mpa double precision,
    required_strength_mpa integer,
    passed boolean,
    test_date date NOT NULL,
    notes text
);


ALTER TABLE public.quality_tests OWNER TO precast;

--
-- Name: quality_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.quality_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.quality_tests_id_seq OWNER TO precast;

--
-- Name: quality_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.quality_tests_id_seq OWNED BY public.quality_tests.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    must_change_password boolean NOT NULL,
    role character varying(50) NOT NULL,
    factory_id integer,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO precast;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO precast;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: wetcasting_activity; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.wetcasting_activity (
    id integer NOT NULL,
    factory_id integer,
    user_id integer NOT NULL,
    section character varying(50) NOT NULL,
    action character varying(80) NOT NULL,
    entity_type character varying(50),
    entity_id integer,
    details json,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.wetcasting_activity OWNER TO precast;

--
-- Name: wetcasting_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.wetcasting_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.wetcasting_activity_id_seq OWNER TO precast;

--
-- Name: wetcasting_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.wetcasting_activity_id_seq OWNED BY public.wetcasting_activity.id;


--
-- Name: yard_inventory; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.yard_inventory (
    id integer NOT NULL,
    factory_id integer,
    element_id integer,
    location_id integer,
    quantity integer NOT NULL
);


ALTER TABLE public.yard_inventory OWNER TO precast;

--
-- Name: yard_inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.yard_inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.yard_inventory_id_seq OWNER TO precast;

--
-- Name: yard_inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.yard_inventory_id_seq OWNED BY public.yard_inventory.id;


--
-- Name: yard_locations; Type: TABLE; Schema: public; Owner: precast
--

CREATE TABLE public.yard_locations (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    factory_id integer,
    description character varying(255)
);


ALTER TABLE public.yard_locations OWNER TO precast;

--
-- Name: yard_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: precast
--

CREATE SEQUENCE public.yard_locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.yard_locations_id_seq OWNER TO precast;

--
-- Name: yard_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: precast
--

ALTER SEQUENCE public.yard_locations_id_seq OWNED BY public.yard_locations.id;


--
-- Name: dispatch_items id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_items ALTER COLUMN id SET DEFAULT nextval('public.dispatch_items_id_seq'::regclass);


--
-- Name: dispatch_orders id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders ALTER COLUMN id SET DEFAULT nextval('public.dispatch_orders_id_seq'::regclass);


--
-- Name: element_moulds id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.element_moulds ALTER COLUMN id SET DEFAULT nextval('public.element_moulds_id_seq'::regclass);


--
-- Name: elements id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements ALTER COLUMN id SET DEFAULT nextval('public.elements_id_seq'::regclass);


--
-- Name: factories id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.factories ALTER COLUMN id SET DEFAULT nextval('public.factories_id_seq'::regclass);


--
-- Name: hollowcore_beds id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_beds ALTER COLUMN id SET DEFAULT nextval('public.hollowcore_beds_id_seq'::regclass);


--
-- Name: hollowcore_casts id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts ALTER COLUMN id SET DEFAULT nextval('public.hollowcore_casts_id_seq'::regclass);


--
-- Name: hollowcore_settings id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_settings ALTER COLUMN id SET DEFAULT nextval('public.hollowcore_settings_id_seq'::regclass);


--
-- Name: mix_designs id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.mix_designs ALTER COLUMN id SET DEFAULT nextval('public.mix_designs_id_seq'::regclass);


--
-- Name: moulds id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.moulds ALTER COLUMN id SET DEFAULT nextval('public.moulds_id_seq'::regclass);


--
-- Name: planner_delays id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays ALTER COLUMN id SET DEFAULT nextval('public.planner_delays_id_seq'::regclass);


--
-- Name: production_schedule id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule ALTER COLUMN id SET DEFAULT nextval('public.production_schedule_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: quality_tests id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.quality_tests ALTER COLUMN id SET DEFAULT nextval('public.quality_tests_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: wetcasting_activity id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.wetcasting_activity ALTER COLUMN id SET DEFAULT nextval('public.wetcasting_activity_id_seq'::regclass);


--
-- Name: yard_inventory id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory ALTER COLUMN id SET DEFAULT nextval('public.yard_inventory_id_seq'::regclass);


--
-- Name: yard_locations id; Type: DEFAULT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_locations ALTER COLUMN id SET DEFAULT nextval('public.yard_locations_id_seq'::regclass);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.alembic_version (version_num) FROM stdin;
ab1c2d3e4f5a
\.


--
-- Data for Name: dispatch_items; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.dispatch_items (id, dispatch_id, yard_inventory_id, quantity) FROM stdin;
6	3	3	10
7	4	1	8
8	1	2	5
9	1	3	40
10	5	4	100
11	2	4	50
12	6	3	30
13	7	2	4
\.


--
-- Data for Name: dispatch_orders; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.dispatch_orders (id, factory_id, project_id, dispatch_date, truck_number, status, status_changed_at, status_changed_by) FROM stdin;
3	2	1	2026-03-26	1	completed	\N	\N
4	2	1	2026-03-26	5	completed	\N	\N
1	2	1	2026-03-25	1	completed	\N	\N
5	2	2	2026-03-26	6	completed	\N	\N
2	2	2	2026-03-25	2	completed	2026-04-06 09:32:52.709076	3
6	2	1	2026-04-07	Ca 53332	completed	2026-04-07 08:25:11.306794	3
7	2	1	2026-04-10	ca 5446	completed	2026-04-10 06:38:05.263251	3
8	2	1	2026-04-13	ca 5446	planned	2026-04-14 19:14:58.924524	3
\.


--
-- Data for Name: element_moulds; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.element_moulds (id, element_id, mould_id) FROM stdin;
3	2	1
4	2	2
5	3	3
6	1	1
7	1	2
10	8	5
11	9	5
12	10	4
13	10	6
\.


--
-- Data for Name: elements; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.elements (id, factory_id, project_id, mix_design_id, element_type, element_mark, quantity, volume, due_date, concrete_strength_mpa, requires_cubes, panel_length_mm, slab_thickness_mm, active, status) FROM stdin;
2	2	2	1	Beam	Test beam 2	50	10.00	2026-06-30	40	f	\N	\N	t	planned
3	2	1	1	Staircase	test stair 1	30	5.00	2026-06-30	30	f	\N	\N	t	planned
1	2	1	1	Beam	Test beams 1	40	10.00	2026-06-30	40	f	\N	\N	t	scheduled
8	2	1	2	Footing	Footing 101	15	6.00	2026-05-29	50	t	\N	\N	t	planned
9	2	2	1	Footing	footing 102	15	3.00	2026-05-29	40	t	\N	\N	t	planned
10	2	1	2	Column	col 1 (600x600)	30	3.00	2026-06-30	40	t	\N	\N	t	planned
28	1	3	\N	Hollowcore	HC40-8-12.5mm	170	\N	2026-04-16	30	f	5000	150	t	planned
4	2	1	4	Hollowcore	test 1 Hollow walling 	100	\N	2026-06-30	30	f	5000	150	t	planned
5	2	2	4	Hollowcore	test walling 2	165	\N	2026-06-30	30	f	5000	150	t	planned
27	2	2	4	Hollowcore	walling ( test fail Units test)	30	\N	2026-04-15	30	f	6000	150	t	planned
26	2	2	4	Hollowcore	first floor slabs 	300	\N	2026-06-30	30	f	4000	250	t	planned
25	2	1	4	Hollowcore	walling HC 3	150	\N	2026-05-29	30	f	6000	200	t	planned
24	2	1	4	Hollowcore	HC 455	20	\N	2026-04-16	30	f	3000	150	t	planned
23	2	1	4	Hollowcore	Hcbb	12	\N	2026-04-16	30	f	4000	150	t	planned
22	2	1	4	Hollowcore	HCC	15	\N	2026-04-16	30	f	5000	150	t	planned
13	2	1	4	Hollowcore	Hc 1	1	\N	2026-04-14	30	f	6000	150	t	planned
12	2	2	4	Hollowcore	walling 500 TQ	84	\N	2026-06-19	30	f	4000	150	t	planned
11	2	1	4	Hollowcore	Walling 500cf	100	\N	2026-04-30	30	f	6000	200	t	planned
\.


--
-- Data for Name: factories; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.factories (id, name, is_active) FROM stdin;
2	Roann Testing 	t
1	Cape Concrete	t
\.


--
-- Data for Name: hollowcore_beds; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.hollowcore_beds (id, factory_id, name, length_mm, max_casts_per_day, active, created_at) FROM stdin;
1	2	bed 1	100000	1	t	2026-03-25 17:11:55.931834
2	2	bed 2	100000	1	t	2026-03-25 17:12:15.122025
3	2	bed 3	100000	1	t	2026-03-25 17:12:28.949852
4	2	bed 4	100000	1	t	2026-03-25 21:01:17.497174
5	2	bed 5 	100000	1	t	2026-04-14 15:12:36.559825
6	1	Bed 1	144000	1	t	2026-04-15 07:40:53.693976
7	1	Bed 2	144000	1	t	2026-04-15 07:41:05.997565
8	1	Bed 3	144000	1	t	2026-04-15 07:41:22.225962
9	1	Bed 4	144000	1	t	2026-04-15 07:41:35.075944
10	1	Bed 5 	144000	1	t	2026-04-15 07:41:45.964513
\.


--
-- Data for Name: hollowcore_casts; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.hollowcore_casts (id, factory_id, element_id, cast_date, bed_number, bed_id, cast_slot_index, slab_thickness_mm, panel_length_mm, quantity, used_length_mm, waste_mm, batch_id, status, created_by, created_at) FROM stdin;
28	2	13	2026-04-10	4	4	0	150	6000	1	6000	94000	HC-2-28-E8CE50	completed	3	2026-04-10 12:24:26.03766
667	1	28	2026-04-15	6	6	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.528322
668	1	28	2026-04-15	7	7	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.533897
669	1	28	2026-04-15	8	8	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.535109
670	1	28	2026-04-15	9	9	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.536024
1	2	4	2026-03-25	1	1	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:12:48.821736
2	2	4	2026-03-25	2	2	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:12:48.821761
3	2	4	2026-03-25	3	3	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:12:48.82177
671	1	28	2026-04-15	10	10	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.53668
672	1	28	2026-04-16	6	6	0	150	5000	28	140000	0	\N	planned	5	2026-04-15 10:48:13.537264
673	1	28	2026-04-16	7	7	0	150	5000	2	10000	130000	\N	planned	5	2026-04-15 10:48:13.537929
21	2	11	2026-04-09	1	1	0	200	6000	16	96000	4000	HC-2-21-2C80CB	completed	3	2026-04-08 11:53:22.37781
37	2	22	2026-04-13	1	1	0	150	5000	15	75000	21000	HC-2-37-CF771C	completed	3	2026-04-10 13:17:24.305791
15	2	4	2026-03-25	4	4	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 21:01:33.433068
38	2	23	2026-04-13	1	1	1	150	4000	5	20000	1000	HC-2-38-6BDFC5	completed	3	2026-04-10 13:17:24.308788
4	2	5	2026-03-26	1	1	0	150	5000	3	15000	85000	\N	completed	3	2026-03-25 17:36:58.068586
5	2	4	2026-03-26	2	2	0	150	5000	5	25000	75000	\N	completed	3	2026-03-25 17:36:58.068593
6	2	5	2026-03-26	3	3	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068594
39	2	23	2026-04-13	2	2	0	150	4000	7	28000	68000	HC-2-39-37CF34	completed	3	2026-04-10 13:17:24.310584
16	2	4	2026-03-26	4	4	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 21:04:34.685171
7	2	5	2026-03-27	1	1	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068596
8	2	5	2026-03-27	2	2	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068597
9	2	5	2026-03-27	3	3	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068598
10	2	5	2026-03-28	1	1	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.0686
11	2	5	2026-03-28	2	2	0	150	5000	12	60000	40000	\N	completed	3	2026-03-25 17:36:58.068601
12	2	5	2026-03-28	3	3	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068602
13	2	5	2026-03-29	1	1	0	150	5000	19	95000	5000	\N	completed	3	2026-03-25 17:36:58.068604
14	2	5	2026-03-29	2	2	0	150	5000	17	85000	15000	\N	completed	3	2026-03-25 17:36:58.068605
40	2	24	2026-04-13	2	2	1	150	3000	20	60000	8000	HC-2-40-F2E94B	completed	3	2026-04-10 13:17:24.31205
41	2	25	2026-04-13	3	3	0	200	6000	16	96000	0	HC-2-41-FD4BF0	completed	3	2026-04-12 16:44:11.188214
42	2	25	2026-04-13	4	4	0	200	6000	16	96000	0	HC-2-42-370D3D	completed	3	2026-04-12 16:44:11.19583
17	2	11	2026-04-08	1	1	0	200	6000	16	96000	4000	\N	completed	3	2026-04-08 11:53:22.377801
18	2	11	2026-04-08	2	2	0	200	6000	16	96000	4000	HC-2-18-15C102	completed	3	2026-04-08 11:53:22.377806
19	2	11	2026-04-08	3	3	0	200	6000	16	96000	4000	HC-2-19-94DABA	completed	3	2026-04-08 11:53:22.377808
20	2	11	2026-04-08	4	4	0	200	6000	16	96000	4000	HC-2-20-938ECE	completed	3	2026-04-08 11:53:22.377809
43	2	25	2026-04-14	1	1	0	200	6000	16	96000	0	HC-2-43-975EDD	completed	3	2026-04-12 16:44:11.19696
44	2	25	2026-04-14	2	2	0	200	6000	16	96000	0	HC-2-44-D0A0C6	completed	3	2026-04-12 16:44:11.197856
45	2	25	2026-04-14	3	3	0	200	6000	16	96000	0	HC-2-45-48D50C	completed	3	2026-04-12 16:44:11.198736
46	2	25	2026-04-14	4	4	0	200	6000	16	96000	0	HC-2-46-34D604	completed	3	2026-04-12 16:44:11.19936
22	2	11	2026-04-09	2	2	0	200	6000	16	96000	4000	HC-2-22-7DB6FC	completed	3	2026-04-08 11:53:22.377812
23	2	11	2026-04-09	3	3	0	200	6000	4	24000	76000	HC-2-23-36FD2A	completed	3	2026-04-08 11:53:22.377813
24	2	12	2026-04-09	4	4	0	150	4000	24	96000	4000	HC-2-24-041070	completed	3	2026-04-08 20:56:32.574562
25	2	12	2026-04-10	1	1	0	150	4000	24	96000	4000	HC-2-25-85D849	completed	3	2026-04-08 20:56:32.574568
26	2	12	2026-04-10	2	2	0	150	4000	24	96000	4000	HC-2-26-3CC61C	completed	3	2026-04-08 20:56:32.57457
27	2	12	2026-04-10	3	3	0	150	4000	12	48000	52000	HC-2-27-B405C6	completed	3	2026-04-08 20:56:32.574571
593	2	27	2026-04-15	1	1	0	150	6000	14	84000	12000	HC-2-593-4F0F3E	completed	3	2026-04-15 06:43:18.011761
629	2	25	2026-04-15	2	2	0	200	6000	16	96000	0	HC-2-629-507CF3	completed	3	2026-04-15 06:51:34.329809
630	2	25	2026-04-15	3	3	0	200	6000	16	96000	0	HC-2-630-F371E6	completed	3	2026-04-15 06:51:34.330726
631	2	25	2026-04-15	4	4	0	200	6000	16	96000	0	HC-2-631-F3B0F7	completed	3	2026-04-15 06:51:34.331294
632	2	25	2026-04-15	5	5	0	200	6000	6	36000	60000	HC-2-632-9218BD	completed	3	2026-04-15 06:51:34.3318
633	2	26	2026-04-15	5	5	1	250	4000	15	60000	0	HC-2-633-ACCB4C	completed	3	2026-04-15 06:51:34.332263
152	2	27	2026-04-14	5	5	0	150	6000	16	96000	0	HC-2-152-09841F	completed	3	2026-04-14 15:32:51.734518
634	2	26	2026-04-16	1	1	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.332733
635	2	26	2026-04-16	2	2	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.3332
636	2	26	2026-04-16	3	3	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.333611
637	2	26	2026-04-16	4	4	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.334063
638	2	26	2026-04-16	5	5	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.33454
639	2	26	2026-04-17	1	1	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.334957
640	2	26	2026-04-17	2	2	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.335349
641	2	26	2026-04-17	3	3	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.335756
642	2	26	2026-04-17	4	4	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.336165
643	2	26	2026-04-17	5	5	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.336559
644	2	26	2026-04-20	1	1	0	250	4000	24	96000	0	\N	planned	3	2026-04-15 06:51:34.336961
645	2	26	2026-04-20	2	2	0	250	4000	21	84000	12000	\N	planned	3	2026-04-15 06:51:34.33737
\.


--
-- Data for Name: hollowcore_settings; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.hollowcore_settings (id, factory_id, bed_count, bed_length_mm, waste_margin_mm, casts_per_bed_per_day, default_waste_mm, default_casts_per_day, active, updated_at, cutting_strength_mpa, final_strength_mpa) FROM stdin;
1	2	1	6000	2000	1	2000	1	t	2026-04-08 14:52:55.355615	20	35
2	1	1	6000	2000	1	2000	1	t	2026-04-15 07:38:59.793744	35	35
\.


--
-- Data for Name: mix_designs; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.mix_designs (id, name, target_strength_mpa, active, factory_id) FROM stdin;
1	50 mpa Straight	50	t	2
2	70/30 PFA Granite 	60	t	2
3	HC Mix	35	t	1
4	Hollowcore Mix 	\N	t	2
\.


--
-- Data for Name: moulds; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.moulds (id, factory_id, name, mould_type, capacity, cycle_time_hours, active) FROM stdin;
1	2	beam 1	Beam	1	24.00	t
2	2	beam 2	Beam	1	24.00	t
3	2	stair 1	Staircase	1	24.00	t
4	2	Column mould 1	Column	2	24.00	t
5	2	Footing 1 mould 	Footing	1	24.00	t
6	2	Column Mould 2 	Column	1	24.00	t
\.


--
-- Data for Name: planner_delays; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.planner_delays (id, factory_id, planner_type, delay_date, mould_id, bed_id, lost_capacity, reason, created_by, created_at) FROM stdin;
5	2	production	2026-04-22	4	\N	1	mould cleaning	3	2026-04-08 10:16:20.997801
6	2	production	2026-04-14	6	\N	1	cleaning mould	3	2026-04-08 10:23:36.699463
\.


--
-- Data for Name: production_schedule; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.production_schedule (id, factory_id, element_id, mould_id, production_date, quantity, batch_id, status, created_at) FROM stdin;
723	2	1	1	2026-03-31	1	\N	completed	2026-03-26 10:16:14.855137
812	2	3	3	2026-03-31	1	\N	completed	2026-03-26 10:16:15.147044
1321	2	2	1	2026-04-07	1	\N	completed	2026-04-06 10:56:07.323337
11706	2	2	1	2026-04-10	1	\N	completed	2026-04-09 16:57:39.791629
16126	2	2	1	2026-04-13	1	\N	completed	2026-04-12 19:10:04.586555
16296	2	2	1	2026-04-14	1	\N	completed	2026-04-13 13:57:31.676976
931	2	3	3	2026-04-01	1	\N	completed	2026-03-31 10:36:10.107451
1451	2	2	1	2026-04-08	1	\N	completed	2026-04-07 08:20:33.868418
2	2	1	2	2026-03-25	1	\N	completed	2026-03-25 17:07:59.034894
91	2	3	3	2026-03-25	1	\N	completed	2026-03-25 17:07:59.321041
3	2	1	1	2026-03-26	1	\N	completed	2026-03-25 17:07:59.037715
92	2	3	3	2026-03-26	1	\N	completed	2026-03-25 17:07:59.323321
724	2	1	2	2026-03-31	1	\N	completed	2026-03-26 10:16:14.857745
841	2	1	1	2026-04-01	1	\N	completed	2026-03-31 10:36:09.935903
1452	2	2	2	2026-04-08	1	\N	completed	2026-04-07 08:20:33.871084
1501	2	3	3	2026-04-08	1	\N	completed	2026-04-07 08:20:33.965138
16300	2	2	1	2026-04-16	1	\N	planned	2026-04-13 13:57:31.709742
16301	2	2	2	2026-04-16	1	\N	planned	2026-04-13 13:57:31.71534
16302	2	2	1	2026-04-17	1	\N	planned	2026-04-13 13:57:31.727358
16303	2	2	2	2026-04-17	1	\N	planned	2026-04-13 13:57:31.734544
16304	2	2	1	2026-04-20	1	\N	planned	2026-04-13 13:57:31.742637
1	2	1	1	2026-03-25	1	\N	completed	2026-03-25 17:07:59.026095
4	2	1	2	2026-03-26	1	\N	completed	2026-03-25 17:07:59.040492
16305	2	2	2	2026-04-20	1	\N	planned	2026-04-13 13:57:31.749379
16306	2	2	1	2026-04-21	1	\N	planned	2026-04-13 13:57:31.759947
16307	2	2	2	2026-04-21	1	\N	planned	2026-04-13 13:57:31.769329
16308	2	2	1	2026-04-22	1	\N	planned	2026-04-13 13:57:31.781961
16309	2	2	2	2026-04-22	1	\N	planned	2026-04-13 13:57:31.787355
16310	2	2	1	2026-04-23	1	\N	planned	2026-04-13 13:57:31.799426
16311	2	2	2	2026-04-23	1	\N	planned	2026-04-13 13:57:31.802952
16312	2	2	1	2026-04-24	1	\N	planned	2026-04-13 13:57:31.812147
16313	2	2	2	2026-04-24	1	\N	planned	2026-04-13 13:57:31.817132
16314	2	2	1	2026-04-28	1	\N	planned	2026-04-13 13:57:31.82818
16315	2	2	2	2026-04-28	1	\N	planned	2026-04-13 13:57:31.832093
16316	2	2	1	2026-04-29	1	\N	planned	2026-04-13 13:57:31.840607
16317	2	2	2	2026-04-29	1	\N	planned	2026-04-13 13:57:31.843493
16318	2	2	1	2026-04-30	1	\N	planned	2026-04-13 13:57:31.851995
16319	2	2	2	2026-04-30	1	\N	planned	2026-04-13 13:57:31.856855
16320	2	2	1	2026-05-04	1	\N	planned	2026-04-13 13:57:31.864612
16321	2	2	2	2026-05-04	1	\N	planned	2026-04-13 13:57:31.869284
16322	2	2	1	2026-05-05	1	\N	planned	2026-04-13 13:57:31.876393
16323	2	2	2	2026-05-05	1	\N	planned	2026-04-13 13:57:31.880252
16324	2	2	1	2026-05-06	1	\N	planned	2026-04-13 13:57:31.888134
16325	2	2	2	2026-05-06	1	\N	planned	2026-04-13 13:57:31.891349
16326	2	2	1	2026-05-07	1	\N	planned	2026-04-13 13:57:31.895923
16327	2	2	2	2026-05-07	1	\N	planned	2026-04-13 13:57:31.897303
16328	2	2	1	2026-05-08	1	\N	planned	2026-04-13 13:57:31.899343
16329	2	2	2	2026-05-08	1	\N	planned	2026-04-13 13:57:31.900615
16330	2	2	1	2026-05-11	1	\N	planned	2026-04-13 13:57:31.90254
16331	2	2	2	2026-05-11	1	\N	planned	2026-04-13 13:57:31.903486
16332	2	2	1	2026-05-12	1	\N	planned	2026-04-13 13:57:31.905356
16333	2	2	2	2026-05-12	1	\N	planned	2026-04-13 13:57:31.906228
16334	2	2	1	2026-05-13	1	\N	planned	2026-04-13 13:57:31.907874
16335	2	2	2	2026-05-13	1	\N	planned	2026-04-13 13:57:31.908734
16336	2	2	1	2026-05-14	1	\N	planned	2026-04-13 13:57:31.910481
16337	2	2	2	2026-05-14	1	\N	planned	2026-04-13 13:57:31.911516
16338	2	2	1	2026-05-15	1	\N	planned	2026-04-13 13:57:31.913297
16339	2	2	2	2026-05-15	1	\N	planned	2026-04-13 13:57:31.91421
16340	2	2	1	2026-05-18	1	\N	planned	2026-04-13 13:57:31.91622
16341	2	2	2	2026-05-18	1	\N	planned	2026-04-13 13:57:31.917469
16342	2	2	1	2026-05-19	1	\N	planned	2026-04-13 13:57:31.919269
16343	2	2	2	2026-05-19	1	\N	planned	2026-04-13 13:57:31.920171
16344	2	2	1	2026-05-20	1	\N	planned	2026-04-13 13:57:31.92192
16345	2	2	2	2026-05-20	1	\N	planned	2026-04-13 13:57:31.922837
16348	2	3	3	2026-04-16	1	\N	planned	2026-04-13 13:57:31.929102
16349	2	3	3	2026-04-17	1	\N	planned	2026-04-13 13:57:31.930846
16350	2	3	3	2026-04-20	1	\N	planned	2026-04-13 13:57:31.932979
16351	2	3	3	2026-04-21	1	\N	planned	2026-04-13 13:57:31.934788
16352	2	3	3	2026-04-22	1	\N	planned	2026-04-13 13:57:31.936241
16353	2	3	3	2026-04-23	1	\N	planned	2026-04-13 13:57:31.937731
16354	2	3	3	2026-04-24	1	\N	planned	2026-04-13 13:57:31.93923
16355	2	3	3	2026-04-28	1	\N	planned	2026-04-13 13:57:31.940639
16356	2	3	3	2026-04-29	1	\N	planned	2026-04-13 13:57:31.942483
16357	2	3	3	2026-04-30	1	\N	planned	2026-04-13 13:57:31.944002
16358	2	3	3	2026-05-04	1	\N	planned	2026-04-13 13:57:31.945472
16359	2	3	3	2026-05-05	1	\N	planned	2026-04-13 13:57:31.946845
16360	2	3	3	2026-05-06	1	\N	planned	2026-04-13 13:57:31.948739
16361	2	3	3	2026-05-07	1	\N	planned	2026-04-13 13:57:31.950148
16362	2	3	3	2026-05-08	1	\N	planned	2026-04-13 13:57:31.951636
16363	2	3	3	2026-05-11	1	\N	planned	2026-04-13 13:57:31.953336
16364	2	3	3	2026-05-12	1	\N	planned	2026-04-13 13:57:31.954799
16365	2	3	3	2026-05-13	1	\N	planned	2026-04-13 13:57:31.956179
16366	2	3	3	2026-05-14	1	\N	planned	2026-04-13 13:57:31.95765
16367	2	3	3	2026-05-15	1	\N	planned	2026-04-13 13:57:31.959185
16368	2	3	3	2026-05-18	1	\N	planned	2026-04-13 13:57:31.960755
16369	2	3	3	2026-05-19	1	\N	planned	2026-04-13 13:57:31.962135
16370	2	3	3	2026-05-20	1	\N	planned	2026-04-13 13:57:31.963721
16371	2	3	3	2026-05-21	1	\N	planned	2026-04-13 13:57:31.96534
16372	2	3	3	2026-05-22	1	\N	planned	2026-04-13 13:57:31.966768
16373	2	3	3	2026-05-25	1	\N	planned	2026-04-13 13:57:31.968321
16374	2	3	3	2026-05-26	1	\N	planned	2026-04-13 13:57:31.969838
16375	2	3	3	2026-05-27	1	\N	planned	2026-04-13 13:57:31.971224
16376	2	1	1	2026-05-21	1	\N	planned	2026-04-13 13:57:31.99719
16377	2	1	2	2026-05-21	1	\N	planned	2026-04-13 13:57:31.998977
16378	2	1	1	2026-05-22	1	\N	planned	2026-04-13 13:57:32.004442
16379	2	1	2	2026-05-22	1	\N	planned	2026-04-13 13:57:32.00571
16380	2	1	1	2026-05-25	1	\N	planned	2026-04-13 13:57:32.010189
16381	2	1	2	2026-05-25	1	\N	planned	2026-04-13 13:57:32.011646
16382	2	1	1	2026-05-26	1	\N	planned	2026-04-13 13:57:32.013994
16383	2	1	2	2026-05-26	1	\N	planned	2026-04-13 13:57:32.015225
16384	2	1	1	2026-05-27	1	\N	planned	2026-04-13 13:57:32.017217
16385	2	1	2	2026-05-27	1	\N	planned	2026-04-13 13:57:32.018132
16386	2	1	1	2026-05-28	1	\N	planned	2026-04-13 13:57:32.019943
16387	2	1	2	2026-05-28	1	\N	planned	2026-04-13 13:57:32.02112
16388	2	1	1	2026-05-29	1	\N	planned	2026-04-13 13:57:32.023871
16389	2	1	2	2026-05-29	1	\N	planned	2026-04-13 13:57:32.025194
16390	2	1	1	2026-06-01	1	\N	planned	2026-04-13 13:57:32.027207
16391	2	1	2	2026-06-01	1	\N	planned	2026-04-13 13:57:32.028806
16392	2	1	1	2026-06-02	1	\N	planned	2026-04-13 13:57:32.031295
16393	2	1	2	2026-06-02	1	\N	planned	2026-04-13 13:57:32.032444
16394	2	1	1	2026-06-03	1	\N	planned	2026-04-13 13:57:32.034408
16395	2	1	2	2026-06-03	1	\N	planned	2026-04-13 13:57:32.036312
16297	2	2	2	2026-04-14	1	\N	completed	2026-04-13 13:57:31.685072
16346	2	3	3	2026-04-14	1	\N	completed	2026-04-13 13:57:31.925564
16298	2	2	1	2026-04-15	1	\N	completed	2026-04-13 13:57:31.693373
16299	2	2	2	2026-04-15	1	\N	completed	2026-04-13 13:57:31.700125
16347	2	3	3	2026-04-15	1	\N	completed	2026-04-13 13:57:31.927626
16127	2	2	2	2026-04-13	1	\N	completed	2026-04-12 19:10:04.592776
16176	2	3	3	2026-04-13	1	\N	completed	2026-04-12 19:10:04.930726
842	2	1	2	2026-04-01	1	\N	completed	2026-03-31 10:36:09.940706
2911	2	8	5	2026-04-08	1	CUBE-20260408-2911-5EFB9E	completed	2026-04-08 09:46:21.93052
3696	2	10	4	2026-04-08	2	CUBE-20260408-3696-A68BE9	completed	2026-04-08 09:59:10.283049
3697	2	10	6	2026-04-08	1	CUBE-20260408-3697-E1CDB4	completed	2026-04-08 09:59:10.285335
1322	2	2	2	2026-04-07	1	\N	completed	2026-04-06 10:56:07.330262
1371	2	3	3	2026-04-07	1	\N	completed	2026-04-06 10:56:07.477633
11707	2	2	2	2026-04-10	1	\N	completed	2026-04-09 16:57:39.801643
16396	2	1	1	2026-06-04	1	\N	planned	2026-04-13 13:57:32.038689
11756	2	3	3	2026-04-10	1	\N	completed	2026-04-09 16:57:40.203321
16397	2	1	2	2026-06-04	1	\N	planned	2026-04-13 13:57:32.039881
16398	2	1	1	2026-06-05	1	\N	planned	2026-04-13 13:57:32.043312
16399	2	1	2	2026-06-05	1	\N	planned	2026-04-13 13:57:32.044755
16400	2	1	1	2026-06-08	1	\N	planned	2026-04-13 13:57:32.046859
16401	2	1	2	2026-06-08	1	\N	planned	2026-04-13 13:57:32.048099
16402	2	1	1	2026-06-09	1	\N	planned	2026-04-13 13:57:32.051045
16403	2	1	2	2026-06-09	1	\N	planned	2026-04-13 13:57:32.052395
16404	2	1	1	2026-06-10	1	\N	planned	2026-04-13 13:57:32.054508
16405	2	1	2	2026-06-10	1	\N	planned	2026-04-13 13:57:32.056161
16406	2	1	1	2026-06-11	1	\N	planned	2026-04-13 13:57:32.059487
16407	2	1	2	2026-06-11	1	\N	planned	2026-04-13 13:57:32.060837
16408	2	1	1	2026-06-12	1	\N	planned	2026-04-13 13:57:32.064028
16409	2	1	2	2026-06-12	1	\N	planned	2026-04-13 13:57:32.065411
16410	2	1	1	2026-06-15	1	\N	planned	2026-04-13 13:57:32.067674
16411	2	1	2	2026-06-15	1	\N	planned	2026-04-13 13:57:32.069035
16412	2	1	1	2026-06-17	1	\N	planned	2026-04-13 13:57:32.072606
16413	2	1	2	2026-06-17	1	\N	planned	2026-04-13 13:57:32.073965
16414	2	1	1	2026-06-18	1	\N	planned	2026-04-13 13:57:32.076578
16415	2	1	2	2026-06-18	1	\N	planned	2026-04-13 13:57:32.078315
16446	2	10	4	2026-04-14	2	CUBE-20260414-16446-22E029	completed	2026-04-13 13:57:32.164569
16416	2	8	5	2026-04-14	1	CUBE-20260414-16416-A220F7	completed	2026-04-13 13:57:32.081253
16417	2	8	5	2026-04-15	1	CUBE-20260415-16417-2B75CC	completed	2026-04-13 13:57:32.084879
16418	2	8	5	2026-04-16	1	CUBE-20260416-16418-6146D8	planned	2026-04-13 13:57:32.087331
16448	2	10	4	2026-04-15	2	CUBE-20260415-16448-194B92	completed	2026-04-13 13:57:32.169542
16419	2	8	5	2026-04-17	1	CUBE-20260417-16419-2DEDAD	planned	2026-04-13 13:57:32.089692
16449	2	10	6	2026-04-15	1	CUBE-20260415-16449-39E782	completed	2026-04-13 13:57:32.171125
16420	2	8	5	2026-04-20	1	CUBE-20260420-16420-2785F8	planned	2026-04-13 13:57:32.092665
16421	2	8	5	2026-04-21	1	CUBE-20260421-16421-B6BB63	planned	2026-04-13 13:57:32.094661
16422	2	8	5	2026-04-22	1	CUBE-20260422-16422-FFA82E	planned	2026-04-13 13:57:32.096385
16423	2	8	5	2026-04-23	1	CUBE-20260423-16423-218F72	planned	2026-04-13 13:57:32.099186
16424	2	8	5	2026-04-24	1	CUBE-20260424-16424-E310C6	planned	2026-04-13 13:57:32.101476
16425	2	8	5	2026-04-28	1	CUBE-20260428-16425-90A94F	planned	2026-04-13 13:57:32.104408
16426	2	8	5	2026-04-29	1	CUBE-20260429-16426-9990E5	planned	2026-04-13 13:57:32.107332
16427	2	8	5	2026-04-30	1	CUBE-20260430-16427-513D91	planned	2026-04-13 13:57:32.109653
16428	2	8	5	2026-05-04	1	CUBE-20260504-16428-75877A	planned	2026-04-13 13:57:32.112013
16429	2	8	5	2026-05-05	1	CUBE-20260505-16429-8E223B	planned	2026-04-13 13:57:32.114138
16430	2	8	5	2026-05-06	1	CUBE-20260506-16430-112A21	planned	2026-04-13 13:57:32.116064
16431	2	9	5	2026-05-07	1	CUBE-20260507-16431-153BEF	planned	2026-04-13 13:57:32.126849
16432	2	9	5	2026-05-08	1	CUBE-20260508-16432-7CE306	planned	2026-04-13 13:57:32.128987
16433	2	9	5	2026-05-11	1	CUBE-20260511-16433-504F5D	planned	2026-04-13 13:57:32.130924
16434	2	9	5	2026-05-12	1	CUBE-20260512-16434-9B8F51	planned	2026-04-13 13:57:32.133505
16435	2	9	5	2026-05-13	1	CUBE-20260513-16435-64792C	planned	2026-04-13 13:57:32.136487
16436	2	9	5	2026-05-14	1	CUBE-20260514-16436-2674EF	planned	2026-04-13 13:57:32.138535
16437	2	9	5	2026-05-15	1	CUBE-20260515-16437-E6F306	planned	2026-04-13 13:57:32.141055
16438	2	9	5	2026-05-18	1	CUBE-20260518-16438-CE5BBE	planned	2026-04-13 13:57:32.143059
16439	2	9	5	2026-05-19	1	CUBE-20260519-16439-EE8F71	planned	2026-04-13 13:57:32.145253
16440	2	9	5	2026-05-20	1	CUBE-20260520-16440-8A1DF9	planned	2026-04-13 13:57:32.147991
16441	2	9	5	2026-05-21	1	CUBE-20260521-16441-014FA1	planned	2026-04-13 13:57:32.150303
16442	2	9	5	2026-05-22	1	CUBE-20260522-16442-863B95	planned	2026-04-13 13:57:32.152999
16443	2	9	5	2026-05-25	1	CUBE-20260525-16443-F2B338	planned	2026-04-13 13:57:32.155815
16444	2	9	5	2026-05-26	1	CUBE-20260526-16444-1AEBA1	planned	2026-04-13 13:57:32.157837
16445	2	9	5	2026-05-27	1	CUBE-20260527-16445-0AEB78	planned	2026-04-13 13:57:32.160582
16450	2	10	4	2026-04-16	2	CUBE-20260416-16450-6016C4	planned	2026-04-13 13:57:32.173606
16451	2	10	6	2026-04-16	1	CUBE-20260416-16451-A273AE	planned	2026-04-13 13:57:32.17592
16447	2	10	6	2026-04-18	1	CUBE-20260414-16447-327A19	planned	2026-04-13 13:57:32.16641
16452	2	10	4	2026-04-17	2	CUBE-20260417-16452-ABB950	planned	2026-04-13 13:57:32.178506
16453	2	10	6	2026-04-17	1	CUBE-20260417-16453-6585F3	planned	2026-04-13 13:57:32.180054
16454	2	10	4	2026-04-20	2	CUBE-20260420-16454-F18ACF	planned	2026-04-13 13:57:32.183567
16455	2	10	6	2026-04-20	1	CUBE-20260420-16455-A67030	planned	2026-04-13 13:57:32.185124
16456	2	10	4	2026-04-21	2	CUBE-20260421-16456-392C0E	planned	2026-04-13 13:57:32.187565
16457	2	10	6	2026-04-21	1	CUBE-20260421-16457-623966	planned	2026-04-13 13:57:32.189652
11856	2	10	4	2026-04-10	2	CUBE-20260410-11856-7978F7	completed	2026-04-09 16:57:40.565099
16459	2	10	6	2026-04-22	1	CUBE-20260422-16459-5ABF0A	planned	2026-04-13 13:57:32.193573
11857	2	10	6	2026-04-10	1	CUBE-20260410-11857-167E46	completed	2026-04-09 16:57:40.567365
11826	2	8	5	2026-04-10	1	CUBE-20260410-11826-8F15D7	completed	2026-04-09 16:57:40.467105
16460	2	10	4	2026-04-23	2	CUBE-20260423-16460-ED9171	planned	2026-04-13 13:57:32.19709
16461	2	10	6	2026-04-23	1	CUBE-20260423-16461-0AE5B9	planned	2026-04-13 13:57:32.199183
16462	2	10	4	2026-04-24	2	CUBE-20260424-16462-652A00	planned	2026-04-13 13:57:32.202523
16463	2	10	6	2026-04-24	1	CUBE-20260424-16463-4247CE	planned	2026-04-13 13:57:32.204209
16464	2	10	4	2026-04-28	2	CUBE-20260428-16464-01D607	planned	2026-04-13 13:57:32.206537
16465	2	10	6	2026-04-28	1	CUBE-20260428-16465-164001	planned	2026-04-13 13:57:32.20795
16458	2	10	4	2026-04-25	2	CUBE-20260422-16458-80C56E	planned	2026-04-13 13:57:32.192237
11026	2	2	1	2026-04-09	1	\N	completed	2026-04-09 16:53:43.342889
11027	2	2	2	2026-04-09	1	\N	completed	2026-04-09 16:53:43.345394
11076	2	3	3	2026-04-09	1	\N	completed	2026-04-09 16:53:43.738027
11177	2	10	6	2026-04-07	1	CUBE-20260409-11177-168EBD	completed	2026-04-09 16:53:44.163692
11176	2	10	4	2026-04-09	2	CUBE-20260409-11176-542D68	completed	2026-04-09 16:53:44.161979
11146	2	8	5	2026-04-09	1	CUBE-20260409-11146-AFDB11	completed	2026-04-09 16:53:44.078473
16246	2	8	5	2026-04-13	1	CUBE-20260413-16246-2253BA	completed	2026-04-12 19:10:05.203964
16276	2	10	4	2026-04-13	2	CUBE-20260413-16276-5A042B	completed	2026-04-12 19:10:05.268329
16277	2	10	6	2026-04-13	1	CUBE-20260413-16277-9C8962	completed	2026-04-12 19:10:05.269908
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.projects (id, factory_id, project_name, client, start_date, due_date, status, work_saturday, work_sunday, status_reason, status_changed_at, closed_at) FROM stdin;
2	2	Test project 2	Test client 2	2026-03-25	2026-06-30	active	f	f	\N	2026-04-08 08:21:04.796733	\N
1	2	Test project 1	Test client 1	2026-03-25	2026-06-30	active	f	f	\N	2026-04-08 08:21:11.856134	\N
3	1	PRASA WP1	ESA	2026-02-01	2027-05-31	active	t	t		\N	\N
\.


--
-- Data for Name: quality_tests; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.quality_tests (id, element_id, batch_id, mix_design_id, test_type, result, age_days, cube1_weight_kg, cube1_strength_mpa, cube2_weight_kg, cube2_strength_mpa, cube3_weight_kg, cube3_strength_mpa, avg_strength_mpa, measured_strength_mpa, required_strength_mpa, passed, test_date, notes) FROM stdin;
1	11	HC-2-18-15C102	\N	Cube compressive strength	22.6667 MPa avg @ 1d	1	2.44	21	2.447	22	2.495	25	22.666666666666668	22.666666666666668	20	t	2026-04-08	\N
2	11	HC-2-19-94DABA	\N	Cube compressive strength	20.3333 MPa avg @ 1d	1	2.46	19	2.46	21	2.45	21	20.333333333333332	20.333333333333332	20	t	2026-04-08	\N
3	11	HC-2-20-938ECE	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.44	23	2.46	21	2.47	20	21.333333333333332	21.333333333333332	20	t	2026-04-08	\N
4	11	HC-2-21-2C80CB	\N	Cube compressive strength	20.6667 MPa avg @ 1d	1	2.4	21	2.44	22	2.49	19	20.666666666666668	20.666666666666668	20	t	2026-04-09	\N
5	11	HC-2-22-7DB6FC	\N	Cube compressive strength	21 MPa avg @ 1d	1	2.44	21	2.44	19	2.5	23	21	21	20	t	2026-04-09	\N
6	11	HC-2-23-36FD2A	\N	Cube compressive strength	20.6667 MPa avg @ 1d	1	2.4	21	2.44	19	2.45	22	20.666666666666668	20.666666666666668	20	t	2026-04-09	\N
7	12	HC-2-24-041070	\N	Cube compressive strength	22 MPa avg @ 1d	1	2.4	21	2.45	22	2.4	23	22	22	20	t	2026-04-09	\N
8	12	HC-2-25-85D849	\N	Cube compressive strength	21 MPa avg @ 1d	1	2.45	21	2.42	20	2.44	22	21	21	20	t	2026-04-10	\N
9	12	HC-2-26-3CC61C	\N	Cube compressive strength	22 MPa avg @ 1d	1	2.44	21	2.445	22	2.49	23	22	22	20	t	2026-04-10	\N
10	12	HC-2-27-B405C6	\N	Cube compressive strength	20.6667 MPa avg @ 1d	1	2.44	22	2.44	21	2.4	19	20.666666666666668	20.666666666666668	20	t	2026-04-10	\N
11	13	HC-2-28-E8CE50	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.44	21	2.45	22	2.46	21	21.333333333333332	21.333333333333332	20	t	2026-04-10	\N
12	22	HC-2-37-CF771C	\N	Cube compressive strength	21 MPa avg @ 1d	1	2.44	21	2.45	22	2.48	20	21	21	20	t	2026-04-13	\N
13	23	HC-2-38-6BDFC5	\N	Cube compressive strength	22 MPa avg @ 1d	1	2.45	21	2.459	22	2.489	23	22	22	20	t	2026-04-13	\N
14	23	HC-2-39-37CF34	\N	Cube compressive strength	22.3333 MPa avg @ 1d	1	2.45	22	2.45	23	2.49	22	22.333333333333332	22.333333333333332	20	t	2026-04-13	\N
15	24	HC-2-40-F2E94B	\N	Cube compressive strength	22.3333 MPa avg @ 1d	1	2.4	22	2.45	23	2.45	22	22.333333333333332	22.333333333333332	20	t	2026-04-13	\N
16	25	HC-2-41-FD4BF0	\N	Cube compressive strength	21.6667 MPa avg @ 1d	1	2.45	22	2.45	22	2.46	21	21.666666666666668	21.666666666666668	20	t	2026-04-13	\N
17	25	HC-2-42-370D3D	\N	Cube compressive strength	21 MPa avg @ 1d	1	2.45	22	2.45	21	2.46	20	21	21	20	t	2026-04-13	\N
18	25	HC-2-43-975EDD	\N	Cube compressive strength	21.6667 MPa avg @ 1d	1	2.44	22	2.42	21	2.461	22	21.666666666666668	21.666666666666668	20	t	2026-04-14	\N
19	25	HC-2-44-D0A0C6	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.4	21	2.44	22	2.44	21	21.333333333333332	21.333333333333332	20	t	2026-04-14	\N
20	25	HC-2-45-48D50C	\N	Cube compressive strength	20 MPa avg @ 1d	1	2.44	21	2.44	20	2.45	19	20	20	20	t	2026-04-14	\N
21	25	HC-2-46-34D604	\N	Cube compressive strength	20 MPa avg @ 1d	1	2.44	21	2.44	19	2.45	20	20	20	20	t	2026-04-14	\N
22	10	CUBE-20260409-11177-168EBD	2	Cube compressive strength	40.6667 MPa avg @ 7d	7	2.44	39	2.45	41	2.45	42	40.666666666666664	40.666666666666664	40	t	2026-04-14	\N
23	27	HC-2-152-09841F	\N	Cube compressive strength	20.3333 MPa avg @ 1d	1	2.42	21	2.43	20	2.42	20	20.333333333333332	20.333333333333332	20	t	2026-04-14	\N
29	27	HC-2-593-4F0F3E	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.4	21	2.4	22	2.4	21	21.333333333333332	21.333333333333332	20	t	2026-04-15	\N
30	25	HC-2-629-507CF3	\N	Cube compressive strength	21 MPa avg @ 1d	1	2.4	21	2.4	22	2.4	20	21	21	20	t	2026-04-15	\N
31	25	HC-2-630-F371E6	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.45	22	2.45	21	2.458	21	21.333333333333332	21.333333333333332	20	t	2026-04-15	\N
32	25	HC-2-631-F3B0F7	\N	Cube compressive strength	20 MPa avg @ 1d	1	2.45	20	2.42	21	2.45	19	20	20	20	t	2026-04-15	\N
33	25	HC-2-632-9218BD	\N	Cube compressive strength	21.6667 MPa avg @ 1d	1	2.45	22	2.45	22	2.45	21	21.666666666666668	21.666666666666668	20	t	2026-04-15	\N
34	26	HC-2-633-ACCB4C	\N	Cube compressive strength	21.3333 MPa avg @ 1d	1	2.4	21	2.45	22	2.48	21	21.333333333333332	21.333333333333332	20	t	2026-04-15	\N
35	8	CUBE-20260408-2911-5EFB9E	2	Cube compressive strength	42 MPa avg @ 7d	7	2.45	42	2.4	43	2.4	41	42	42	50	f	2026-04-15	\N
36	10	CUBE-20260408-3696-A68BE9	2	Cube compressive strength	41.6667 MPa avg @ 7d	7	2.45	41	2.45	42	2.45	42	41.666666666666664	41.666666666666664	40	t	2026-04-15	\N
37	10	CUBE-20260408-3697-E1CDB4	2	Cube compressive strength	41 MPa avg @ 7d	7	2.45	43	2.48	41	2.45	39	41	41	40	t	2026-04-15	\N
38	11	HC-2-18-15C102	\N	Cube compressive strength	36 MPa avg @ 7d	7	2.45	38	2.45	36	2.45	34	36	36	35	t	2026-04-15	\N
39	11	HC-2-19-94DABA	\N	Cube compressive strength	35.3333 MPa avg @ 7d	7	2.45	35	2.48	36	2.48	35	35.333333333333336	35.333333333333336	35	t	2026-04-15	\N
40	11	HC-2-20-938ECE	\N	Cube compressive strength	36.3333 MPa avg @ 7d	7	2.45	36	2.45	37	2.45	36	36.333333333333336	36.333333333333336	35	t	2026-04-15	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.users (id, name, email, password_hash, must_change_password, role, factory_id, created_at) FROM stdin;
1	Super Admin	superadmin@local	$pbkdf2-sha256$29000$bI1xLqW01hrjfI/RWss5Zw$2Qvw9etW499hReFeUDOddTyhOmDXSv6sNESwQAN4veE	f	admin	\N	2026-03-25 16:49:05.709661
2	Alwyn 	Alwyn@capeconcrete.com	$pbkdf2-sha256$29000$MAbgHMN4r3XunbN2TikF4A$B6lnWqV8ktiijrLr0t3DPUrB9vDTqCVNzLIMciPzHA4	f	admin	1	2026-03-25 16:51:18.453193
3	Roann	roannheunis@gmail.com	$pbkdf2-sha256$29000$kJLS.l.LUcpZCwGg9B7j3A$C5EXgBiamiRgMIk937j6NZUjGw3nX51wXExODLFvV9Q	f	admin	2	2026-03-25 16:51:54.75311
4	Rigardt 	rigardt.visser@ppc.co.za	$pbkdf2-sha256$29000$KuWcM0YIIeR8r1UqhRCCMA$1lKpqJjnGoTQvQTB7/ABOBhXqPVC1lnHsVBBHUdy4QA	f	production	2	2026-04-07 08:42:35.192134
5	Roy Davy	roy@capeconcrete.co.za	$pbkdf2-sha256$29000$Zuz9XwuBUCpFqPX.fy9FSA$iltyt8NUhGR34gUj4k9vZcVCZyGqolh5/akWsXwh.L4	f	admin	1	2026-04-15 07:16:52.648798
\.


--
-- Data for Name: wetcasting_activity; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.wetcasting_activity (id, factory_id, user_id, section, action, entity_type, entity_id, details, created_at) FROM stdin;
1	2	3	elements	update_element	element	1	{"element_mark": "Test beams 1", "updated_fields": ["concrete_strength_mpa", "due_date", "element_mark", "element_type", "mix_design_id", "quantity", "requires_cubes", "status", "volume"]}	2026-04-06 10:39:22.982996
2	2	3	elements	create_element	element	6	{"element_mark": "stairs second floor", "quantity": 10}	2026-04-06 10:55:48.438063
3	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 130, "unscheduled_count": 0}	2026-04-06 10:56:07.852634
4	2	3	production	update_schedule	schedule	1432	{"updated_fields": ["mould_id", "production_date"]}	2026-04-07 08:14:18.925978
5	2	3	production	update_schedule	schedule	1432	{"updated_fields": ["mould_id", "production_date"]}	2026-04-07 08:14:22.935439
6	2	3	production	complete_schedule	schedule	1321	{"location_id": 1}	2026-04-07 08:15:44.896817
7	2	3	production	complete_schedule	schedule	1322	{"location_id": 1}	2026-04-07 08:15:48.872983
8	2	3	production	complete_schedule	schedule	1371	{"location_id": 1}	2026-04-07 08:15:51.060023
9	2	3	elements	create_element	element	7	{"element_mark": "stair 456", "quantity": 10}	2026-04-07 08:19:12.379231
10	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 140, "unscheduled_count": 0}	2026-04-07 08:20:34.317525
11	2	4	production	complete_schedule	schedule	1451	{"location_id": 1}	2026-04-07 08:49:09.427001
12	2	4	production	complete_schedule	schedule	1452	{"location_id": 1}	2026-04-07 08:49:10.722122
13	2	4	production	complete_schedule	schedule	1501	{"location_id": 1}	2026-04-07 08:49:11.947948
14	2	3	production	update_schedule	schedule	1586	{"element_mark": "stair 456", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 06:24:54.844074
15	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 140, "unscheduled_count": 0}	2026-04-08 06:25:49.121842
16	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 140, "unscheduled_count": 0}	2026-04-08 07:47:34.195392
17	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 140, "unscheduled_count": 0}	2026-04-08 07:48:20.163862
18	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 80, "unscheduled_count": 0}	2026-04-08 08:07:30.828881
19	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 80, "unscheduled_count": 0}	2026-04-08 08:11:32.267967
20	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 80, "unscheduled_count": 0}	2026-04-08 08:11:38.512742
21	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 80, "unscheduled_count": 0}	2026-04-08 08:12:01.657676
22	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 80, "unscheduled_count": 0}	2026-04-08 08:19:33.278901
23	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 140, "unscheduled_count": 0}	2026-04-08 08:21:26.089783
24	2	3	elements	delete_element	element	7	{"element_mark": "stair 456"}	2026-04-08 08:27:35.766423
25	2	3	elements	delete_element	element	6	{"element_mark": "stairs second floor"}	2026-04-08 08:27:46.095783
26	2	3	planner	generate_plan	planner_run	\N	{"scheduled_batches": 120, "unscheduled_count": 0}	2026-04-08 08:28:14.473743
27	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 120, "unscheduled_count": 0}	2026-04-08 09:42:47.867385
28	2	3	elements	create_element	element	8	{"element_mark": "Footing 101", "quantity": 15}	2026-04-08 09:45:53.929088
29	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 135, "unscheduled_count": 0}	2026-04-08 09:46:21.97314
30	2	3	production	complete_schedule	schedule	2911	{"location_id": 1, "element_mark": "Footing 101"}	2026-04-08 09:47:13.20335
31	2	3	elements	create_element	element	9	{"element_mark": "footing 102", "quantity": 15}	2026-04-08 09:49:09.884715
32	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 150, "unscheduled_count": 0}	2026-04-08 09:50:47.032731
33	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 150, "unscheduled_count": 0}	2026-04-08 09:56:16.909539
34	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 150, "unscheduled_count": 0}	2026-04-08 09:56:21.569869
35	2	3	elements	create_element	element	10	{"element_mark": "col 1 (600x600)", "quantity": 30}	2026-04-08 09:57:53.643471
36	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 09:58:07.159833
37	2	3	production	update_schedule	schedule	3545	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 09:58:54.505314
38	2	3	production	update_schedule	schedule	3545	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 09:58:57.416803
39	2	3	production	update_schedule	schedule	3545	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 09:59:03.627804
40	2	3	production	update_schedule	schedule	3545	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 09:59:07.723516
41	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 09:59:10.343723
42	2	3	production	complete_schedule	schedule	3696	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-08 10:00:04.867332
43	2	3	production	complete_schedule	schedule	3697	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-08 10:00:04.964217
44	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:00:08.241862
45	2	3	production	update_schedule	schedule	3836	{"element_mark": "Footing 101", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:00:49.30468
46	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:01:54.947051
47	2	3	planner	create_delay	delay	3	{"planner_type": "production", "delay_date": "2026-04-22", "lost_capacity": 1}	2026-04-08 10:03:13.590922
48	2	3	planner	create_delay	delay	4	{"planner_type": "production", "delay_date": "2026-04-22", "lost_capacity": 1}	2026-04-08 10:03:39.586853
49	2	3	production	update_schedule	schedule	4055	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:03:41.347993
50	2	3	production	update_schedule	schedule	4054	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:03:41.481567
51	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:04:00.076111
52	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:13:47.248301
53	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:14:40.270174
54	2	3	planner	delete_delay	delay	4	null	2026-04-08 10:14:53.312471
55	2	3	planner	delete_delay	delay	3	null	2026-04-08 10:14:54.308941
56	2	3	planner	create_delay	delay	5	{"planner_type": "production", "delay_date": "2026-04-22", "lost_capacity": 1}	2026-04-08 10:16:21.006523
57	2	3	production	update_schedule	schedule	4564	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:16:21.241922
58	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:16:37.11814
59	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:17:11.582458
60	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:17:22.645664
61	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:22:43.70891
62	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:22:52.081083
63	2	3	production	update_schedule	schedule	5414	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:22:53.540223
64	2	3	planner	create_delay	delay	6	{"planner_type": "production", "delay_date": "2026-04-14", "lost_capacity": 1}	2026-04-08 10:23:36.708454
65	2	3	production	update_schedule	schedule	5403	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:23:37.06179
66	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:28:27.623604
67	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:28:45.962487
68	2	3	production	update_schedule	schedule	5743	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:28:47.353285
69	2	3	production	update_schedule	schedule	5754	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:28:47.428243
70	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:29:04.277258
71	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:29:32.26833
72	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:31:06.017293
73	2	3	production	update_schedule	schedule	6253	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:31:07.690573
74	2	3	production	update_schedule	schedule	6264	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:31:07.815698
75	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:31:12.032439
76	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:31:14.434929
77	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:32:51.033543
78	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:32:57.351526
79	2	3	production	update_schedule	schedule	6933	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:32:58.608328
80	2	3	production	update_schedule	schedule	6944	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:32:58.727314
81	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:33:06.606163
82	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:33:24.481547
83	2	3	production	update_schedule	schedule	7273	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:33:25.977982
84	2	3	production	update_schedule	schedule	7284	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:33:26.131616
85	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:39:19.847025
86	2	3	production	update_schedule	schedule	7443	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:39:20.136376
87	2	3	production	update_schedule	schedule	7454	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:39:20.255026
88	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:40:00.427257
89	2	3	production	update_schedule	schedule	7613	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:40:00.772264
90	2	3	production	update_schedule	schedule	7624	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:40:00.846768
91	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:41:00.900561
92	2	3	production	update_schedule	schedule	7783	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:41:01.174223
93	2	3	production	update_schedule	schedule	7794	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:41:01.287883
94	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:45:35.64231
95	2	3	production	update_schedule	schedule	7953	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:45:35.915874
96	2	3	production	update_schedule	schedule	7964	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:45:36.032995
97	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:45:48.827194
98	2	3	production	update_schedule	schedule	8123	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:45:49.091412
99	2	3	production	update_schedule	schedule	8134	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:45:49.208414
100	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:53:24.337988
101	2	3	production	update_schedule	schedule	8293	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:53:24.603155
102	2	3	production	update_schedule	schedule	8304	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 10:53:24.720059
103	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:53:27.330669
104	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:53:30.280519
105	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 10:53:30.671204
106	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 11:27:25.192019
107	2	3	production	update_schedule	schedule	8973	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:27:25.64109
108	2	3	production	update_schedule	schedule	8984	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:27:25.852024
109	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 11:27:51.850433
110	2	3	production	update_schedule	schedule	9143	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:27:52.133044
111	2	3	production	update_schedule	schedule	9154	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:27:52.214988
112	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 11:29:30.356236
113	2	3	production	update_schedule	schedule	9313	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:29:30.679814
114	2	3	production	update_schedule	schedule	9324	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:29:30.788877
115	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 11:30:17.1964
116	2	3	production	update_schedule	schedule	9483	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:30:18.82817
117	2	3	production	update_schedule	schedule	9494	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 11:30:18.92178
118	2	3	elements	create_element	element	11	{"element_mark": "Walling 500cf", "quantity": 100}	2026-04-08 11:47:56.767508
119	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-08 14:58:06.678283
120	2	3	production	update_schedule	schedule	9653	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 14:58:06.982573
121	2	3	production	update_schedule	schedule	9664	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-08 14:58:07.061091
122	2	3	elements	create_element	element	12	{"element_mark": "walling 500 TQ", "quantity": 84}	2026-04-08 15:39:13.212995
123	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:49:55.022706
124	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:49:57.692395
125	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:49:59.223806
126	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:50:00.809831
127	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:50:06.477923
128	2	3	production	update_schedule	schedule	10503	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:50:06.758709
129	2	3	production	update_schedule	schedule	10514	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:50:06.876589
130	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:53:13.566315
131	2	3	production	update_schedule	schedule	10673	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:13.877064
132	2	3	production	update_schedule	schedule	10684	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:13.974176
133	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:53:15.361856
134	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:53:20.035971
135	2	3	production	update_schedule	schedule	11013	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:20.309317
136	2	3	production	update_schedule	schedule	11024	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:20.422658
137	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:53:44.210819
138	2	3	production	update_schedule	schedule	11183	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:44.482219
139	2	3	production	update_schedule	schedule	11194	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:53:44.635864
140	2	3	production	complete_schedule	schedule	11026	{"location_id": 1, "element_mark": "Test beam 2"}	2026-04-09 16:53:57.341624
141	2	3	production	complete_schedule	schedule	11027	{"location_id": 1, "element_mark": "Test beam 2"}	2026-04-09 16:54:00.51426
142	2	3	production	complete_schedule	schedule	11176	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-09 16:54:01.359234
143	2	3	production	complete_schedule	schedule	11177	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-09 16:54:02.253063
144	2	3	production	complete_schedule	schedule	11146	{"location_id": 1, "element_mark": "Footing 101"}	2026-04-09 16:54:02.983665
145	2	3	production	complete_schedule	schedule	11076	{"location_id": 1, "element_mark": "test stair 1"}	2026-04-09 16:54:03.801224
146	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:54:08.568515
147	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:54:09.853069
148	2	3	production	update_schedule	schedule	11521	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:54:10.170867
149	2	3	production	update_schedule	schedule	11532	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:54:10.314062
150	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:57:36.119259
151	2	3	production	update_schedule	schedule	11691	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:57:36.365789
152	2	3	production	update_schedule	schedule	11702	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-09 16:57:36.49017
153	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-09 16:57:40.625187
154	2	3	production	complete_schedule	schedule	11706	{"location_id": 1, "element_mark": "Test beam 2"}	2026-04-10 05:42:15.379616
155	2	3	production	complete_schedule	schedule	11707	{"location_id": 1, "element_mark": "Test beam 2"}	2026-04-10 05:42:16.118833
156	2	3	production	complete_schedule	schedule	11856	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-10 05:42:16.877394
157	2	3	production	complete_schedule	schedule	11857	{"location_id": 1, "element_mark": "col 1 (600x600)"}	2026-04-10 05:42:18.184698
158	2	3	production	complete_schedule	schedule	11826	{"location_id": 1, "element_mark": "Footing 101"}	2026-04-10 05:42:19.110663
159	2	3	production	complete_schedule	schedule	11756	{"location_id": 1, "element_mark": "test stair 1"}	2026-04-10 05:42:20.036931
160	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-10 05:42:25.691203
161	2	3	production	update_schedule	schedule	12029	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 05:42:26.039804
162	2	3	production	update_schedule	schedule	12040	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 05:42:26.154031
163	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-10 05:46:18.193033
164	2	3	production	update_schedule	schedule	12199	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 05:46:18.465365
165	2	3	production	update_schedule	schedule	12210	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 05:46:18.578225
166	2	3	elements	create_element	element	13	{"element_mark": "Hc 1", "quantity": 1}	2026-04-10 12:21:48.21837
167	2	3	elements	create_element	element	14	{"element_mark": "Hc 2", "quantity": 2}	2026-04-10 12:22:09.033931
168	2	3	elements	create_element	element	15	{"element_mark": "hc3", "quantity": 1}	2026-04-10 12:22:27.082933
169	2	3	elements	create_element	element	16	{"element_mark": "hc4", "quantity": 1}	2026-04-10 12:22:52.461411
170	2	3	elements	create_element	element	17	{"element_mark": "HC 1 (200) ", "quantity": 10}	2026-04-10 12:23:38.874828
171	2	3	elements	create_element	element	18	{"element_mark": "HC 2 (200)", "quantity": 15}	2026-04-10 12:23:56.919649
172	2	3	elements	create_element	element	19	{"element_mark": "HC 1 Exceo ", "quantity": 10}	2026-04-10 12:40:03.460488
173	2	3	elements	create_element	element	20	{"element_mark": "HC exceo 2", "quantity": 15}	2026-04-10 12:40:46.478778
174	2	3	elements	create_element	element	21	{"element_mark": "HC Exceo 3 ", "quantity": 20}	2026-04-10 12:41:24.795888
175	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-10 12:41:29.863916
176	2	3	production	update_schedule	schedule	12369	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 12:41:30.188809
177	2	3	production	update_schedule	schedule	12380	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-10 12:41:30.324332
178	2	3	elements	delete_element	element	14	{"element_mark": "Hc 2"}	2026-04-10 12:52:13.967343
179	2	3	elements	delete_element	element	15	{"element_mark": "hc3"}	2026-04-10 12:52:27.512435
180	2	3	elements	delete_element	element	16	{"element_mark": "hc4"}	2026-04-10 12:52:49.306748
181	2	3	elements	delete_element	element	17	{"element_mark": "HC 1 (200) "}	2026-04-10 12:53:34.186247
182	2	3	elements	delete_element	element	18	{"element_mark": "HC 2 (200)"}	2026-04-10 12:54:04.94944
183	2	3	elements	update_element	element	19	{"element_mark": "HC 1 Exceo ", "updated_fields": ["due_date", "element_mark", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-10 12:57:42.272438
184	2	3	elements	delete_element	element	20	{"element_mark": "HC exceo 2"}	2026-04-10 13:16:01.5202
185	2	3	elements	delete_element	element	21	{"element_mark": "HC Exceo 3 "}	2026-04-10 13:16:06.046917
186	2	3	elements	delete_element	element	19	{"element_mark": "HC 1 Exceo "}	2026-04-10 13:16:09.978238
187	2	3	elements	create_element	element	22	{"element_mark": "HCC", "quantity": 15}	2026-04-10 13:16:50.171294
188	2	3	elements	create_element	element	23	{"element_mark": "Hcbb", "quantity": 12}	2026-04-10 13:17:05.699265
189	2	3	elements	create_element	element	24	{"element_mark": "HC 455", "quantity": 20}	2026-04-10 13:17:21.13321
190	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-11 08:05:31.428648
191	2	3	production	update_schedule	schedule	12539	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-11 08:05:31.718687
192	2	3	production	update_schedule	schedule	12550	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-11 08:05:31.833215
193	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-11 08:05:45.572822
194	2	3	production	update_schedule	schedule	12709	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-11 08:05:45.821048
195	2	3	production	update_schedule	schedule	12720	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-11 08:05:45.940756
196	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 07:01:42.016498
197	2	3	production	update_schedule	schedule	12879	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 07:01:42.305839
198	2	3	production	update_schedule	schedule	12890	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 07:01:42.388646
199	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 13:24:17.348016
200	2	3	production	update_schedule	schedule	13049	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:24:17.641699
201	2	3	production	update_schedule	schedule	13060	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:24:17.759199
202	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 13:26:34.492131
203	2	3	production	update_schedule	schedule	13219	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:26:34.776
204	2	3	production	update_schedule	schedule	13230	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:26:34.889289
205	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 13:48:44.024944
206	2	3	production	update_schedule	schedule	13389	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:48:44.364496
207	2	3	production	update_schedule	schedule	13400	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 13:48:44.481017
208	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 14:24:03.534808
209	2	3	production	update_schedule	schedule	13559	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:24:03.821527
210	2	3	production	update_schedule	schedule	13570	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:24:03.935618
211	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 14:44:56.401474
212	2	3	production	update_schedule	schedule	13729	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:44:56.697319
213	2	3	production	update_schedule	schedule	13740	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:44:56.818023
214	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 14:49:44.627939
215	2	3	production	update_schedule	schedule	13899	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:49:45.073801
216	2	3	production	update_schedule	schedule	13910	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:49:45.195411
217	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 14:53:20.97629
270	2	3	elements	create_element	element	27	{"element_mark": "walling ( test fail Units test)", "quantity": 30}	2026-04-14 15:11:42.304569
218	2	3	production	update_schedule	schedule	14069	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:53:21.271003
219	2	3	production	update_schedule	schedule	14080	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 14:53:21.383045
220	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 14:55:42.850556
221	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 15:11:58.81528
222	2	3	production	update_schedule	schedule	14409	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 15:11:59.200172
223	2	3	production	update_schedule	schedule	14420	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 15:11:59.333107
224	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 16:41:41.760328
225	2	3	production	update_schedule	schedule	14579	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:41:42.053412
226	2	3	production	update_schedule	schedule	14590	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:41:42.174396
227	2	3	elements	create_element	element	25	{"element_mark": "walling HC 3", "quantity": 150}	2026-04-12 16:44:08.507445
228	2	3	production	update_schedule	schedule	11177	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:50:51.810247
229	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 16:51:35.927351
230	2	3	production	update_schedule	schedule	14749	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:51:36.218583
231	2	3	production	update_schedule	schedule	14760	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:51:36.335527
232	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 16:51:51.277443
233	2	3	production	update_schedule	schedule	14919	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:51:51.605392
234	2	3	production	update_schedule	schedule	14930	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:51:51.721784
235	2	3	production	update_schedule	schedule	11177	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:16.37921
236	2	3	production	update_schedule	schedule	11177	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:20.748526
237	2	3	production	update_schedule	schedule	11177	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:34.611075
238	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 16:52:37.486305
239	2	3	production	update_schedule	schedule	15089	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:37.788907
240	2	3	production	update_schedule	schedule	15100	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:37.909793
241	2	3	production	update_schedule	schedule	11177	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 16:52:40.184156
242	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:09:44.333862
243	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:09:55.803248
244	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:09:56.638967
245	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:09:57.544196
246	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:10:02.431741
247	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:10:04.047856
248	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-12 19:10:05.311966
249	2	3	production	update_schedule	schedule	16279	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 19:10:05.591911
250	2	3	production	update_schedule	schedule	16290	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-12 19:10:05.708284
251	2	3	production	complete_schedule	schedule	16126	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-13 10:04:22.989241
252	2	3	production	complete_schedule	schedule	16127	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-13 10:04:23.077162
253	2	3	production	complete_schedule	schedule	16176	{"location_id": 2, "element_mark": "test stair 1"}	2026-04-13 10:04:23.200399
254	2	3	production	complete_schedule	schedule	16246	{"location_id": 2, "element_mark": "Footing 101"}	2026-04-13 10:04:23.315348
255	2	3	production	complete_schedule	schedule	16276	{"location_id": 2, "element_mark": "col 1 (600x600)"}	2026-04-13 10:04:23.431204
256	2	3	production	complete_schedule	schedule	16277	{"location_id": 2, "element_mark": "col 1 (600x600)"}	2026-04-13 10:04:23.546959
257	2	3	dispatch	dispatch_status	dispatch_order	8	{"to_status": "cancelled"}	2026-04-13 13:38:41.145593
258	1	2	planner	auto_plan	planner_run	\N	{"scheduled_batches": 0, "unscheduled_count": 0}	2026-04-13 13:40:56.034376
259	2	3	planner	auto_plan	planner_run	\N	{"scheduled_batches": 170, "unscheduled_count": 0}	2026-04-13 13:57:32.214736
260	2	3	production	update_schedule	schedule	16447	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-13 13:57:32.509739
261	2	3	production	update_schedule	schedule	16458	{"element_mark": "col 1 (600x600)", "updated_fields": ["mould_id", "production_date"]}	2026-04-13 13:57:32.636221
262	2	3	yard	move_inventory	yard_inventory	9	{"to_location_id": 2, "moved_quantity": 84, "element_id": 12}	2026-04-13 15:18:40.676477
263	2	3	production	complete_schedule	schedule	16296	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-14 05:40:44.098991
264	2	3	production	complete_schedule	schedule	16297	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-14 05:40:44.85186
265	2	3	production	complete_schedule	schedule	16446	{"location_id": 2, "element_mark": "col 1 (600x600)"}	2026-04-14 05:40:45.704362
266	2	3	production	complete_schedule	schedule	16416	{"location_id": 2, "element_mark": "Footing 101"}	2026-04-14 05:40:46.872235
267	2	3	production	complete_schedule	schedule	16346	{"location_id": 2, "element_mark": "test stair 1"}	2026-04-14 05:40:47.855648
268	2	3	elements	create_element	element	26	{"element_mark": "first floor slabs ", "quantity": 300}	2026-04-14 06:25:31.129248
269	2	3	hollowcore	create_element	element	26	{"element_mark": "first floor slabs ", "quantity": 300, "panel_length_mm": 4000, "slab_thickness_mm": 250}	2026-04-14 06:25:31.129252
271	2	3	hollowcore	create_element	element	27	{"element_mark": "walling ( test fail Units test)", "quantity": 30, "panel_length_mm": 6000, "slab_thickness_mm": 150}	2026-04-14 15:11:42.304573
272	2	3	hollowcore	mark_cast	hollowcore_cast	152	{"element_id": 27, "batch_id": "HC-2-152-09841F", "cast_date": "2026-04-14", "bed_id": 5, "cast_slot_index": 0, "quantity": 16}	2026-04-14 15:37:45.194353
273	2	3	qc	create_test	quality_test	23	{"batch_id": "HC-2-152-09841F", "element_id": 27, "age_days": 1, "passed": false, "avg_strength_mpa": 18.0, "required_strength_mpa": 20, "test_date": "2026-04-14"}	2026-04-14 15:38:16.898029
274	2	3	hollowcore	planner_commit	\N	\N	{"inserted": 0, "updated": 19, "deleted": 0, "cast_count": 19}	2026-04-14 15:41:27.88075
275	2	3	hollowcore	request_retest	hollowcore_cast	152	{"element_id": 27, "batch_id": "HC-2-152-09841F", "cast_date": "2026-04-14", "bed_id": 5, "cast_slot_index": 0, "quantity": 16, "reason": "1-day failed, priority retest requested"}	2026-04-14 16:00:00.319112
276	2	3	hollowcore	request_retest	hollowcore_cast	152	{"element_id": 27, "batch_id": "HC-2-152-09841F", "cast_date": "2026-04-14", "bed_id": 5, "cast_slot_index": 0, "quantity": 16, "reason": "1-day failed, priority retest requested"}	2026-04-14 16:02:04.102834
277	2	3	qc	create_test	quality_test	23	{"batch_id": "HC-2-152-09841F", "element_id": 27, "age_days": 1, "passed": true, "avg_strength_mpa": 20.333333333333332, "required_strength_mpa": 20, "test_date": "2026-04-14"}	2026-04-14 16:13:00.145149
278	2	3	hollowcore	mark_cut	hollowcore_cast	152	{"element_id": 27, "batch_id": "HC-2-152-09841F", "cast_date": "2026-04-14", "bed_id": 5, "cast_slot_index": 0, "quantity": 16}	2026-04-14 16:13:49.72792
279	2	3	hollowcore	complete_cast	hollowcore_cast	152	{"element_id": 27, "batch_id": "HC-2-152-09841F", "cast_date": "2026-04-14", "bed_id": 5, "cast_slot_index": 0, "quantity": 16, "location_id": 2}	2026-04-14 16:14:02.481558
280	2	3	dispatch	dispatch_status	dispatch_order	8	{"to_status": "planned"}	2026-04-14 19:14:58.928643
281	2	3	production	complete_schedule	schedule	16298	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-15 06:42:58.96554
282	2	3	production	complete_schedule	schedule	16299	{"location_id": 2, "element_mark": "Test beam 2"}	2026-04-15 06:42:59.069126
283	2	3	production	complete_schedule	schedule	16347	{"location_id": 2, "element_mark": "test stair 1"}	2026-04-15 06:42:59.176351
284	2	3	production	complete_schedule	schedule	16417	{"location_id": 2, "element_mark": "Footing 101"}	2026-04-15 06:42:59.275469
285	2	3	production	complete_schedule	schedule	16448	{"location_id": 2, "element_mark": "col 1 (600x600)"}	2026-04-15 06:42:59.37689
286	2	3	production	complete_schedule	schedule	16449	{"location_id": 2, "element_mark": "col 1 (600x600)"}	2026-04-15 06:42:59.471735
287	2	3	hollowcore	mark_cast	hollowcore_cast	593	{"element_id": 27, "batch_id": "HC-2-593-4F0F3E", "cast_date": "2026-04-15", "bed_id": 1, "cast_slot_index": 0, "quantity": 14}	2026-04-15 06:44:38.073724
288	2	3	qc	create_test	quality_test	29	{"batch_id": "HC-2-593-4F0F3E", "element_id": 27, "age_days": 1, "passed": true, "avg_strength_mpa": 21.333333333333332, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 06:47:07.85358
289	2	3	hollowcore	mark_cut	hollowcore_cast	593	{"element_id": 27, "batch_id": "HC-2-593-4F0F3E", "cast_date": "2026-04-15", "bed_id": 1, "cast_slot_index": 0, "quantity": 14}	2026-04-15 06:47:39.629115
290	2	3	hollowcore	complete_cast	hollowcore_cast	593	{"element_id": 27, "batch_id": "HC-2-593-4F0F3E", "cast_date": "2026-04-15", "bed_id": 1, "cast_slot_index": 0, "quantity": 14, "location_id": 2}	2026-04-15 06:49:02.366718
291	1	5	elements	create_element	element	28	{"element_mark": "HC40-8-12.5mm", "quantity": 170}	2026-04-15 07:43:07.937734
292	1	5	hollowcore	create_element	element	28	{"element_mark": "HC40-8-12.5mm", "quantity": 170, "panel_length_mm": 5000, "slab_thickness_mm": 150}	2026-04-15 07:43:07.937737
293	2	3	hollowcore	mark_cast	hollowcore_cast	629	{"element_id": 25, "batch_id": "HC-2-629-507CF3", "cast_date": "2026-04-15", "bed_id": 2, "cast_slot_index": 0, "quantity": 16}	2026-04-15 09:53:21.041163
294	2	3	hollowcore	mark_cast	hollowcore_cast	630	{"element_id": 25, "batch_id": "HC-2-630-F371E6", "cast_date": "2026-04-15", "bed_id": 3, "cast_slot_index": 0, "quantity": 16}	2026-04-15 09:53:22.938333
295	2	3	hollowcore	mark_cast	hollowcore_cast	631	{"element_id": 25, "batch_id": "HC-2-631-F3B0F7", "cast_date": "2026-04-15", "bed_id": 4, "cast_slot_index": 0, "quantity": 16}	2026-04-15 09:53:26.06922
296	2	3	hollowcore	mark_cast	hollowcore_cast	632	{"element_id": 25, "batch_id": "HC-2-632-9218BD", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 0, "quantity": 6}	2026-04-15 09:53:27.596982
297	2	3	hollowcore	mark_cast	hollowcore_cast	633	{"element_id": 26, "batch_id": "HC-2-633-ACCB4C", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 1, "quantity": 15}	2026-04-15 09:53:29.163585
298	2	3	qc	create_test	quality_test	30	{"batch_id": "HC-2-629-507CF3", "element_id": 25, "age_days": 1, "passed": true, "avg_strength_mpa": 21.0, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 09:54:04.446344
299	2	3	qc	create_test	quality_test	31	{"batch_id": "HC-2-630-F371E6", "element_id": 25, "age_days": 1, "passed": true, "avg_strength_mpa": 21.333333333333332, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 09:54:42.980175
300	2	3	qc	create_test	quality_test	32	{"batch_id": "HC-2-631-F3B0F7", "element_id": 25, "age_days": 1, "passed": true, "avg_strength_mpa": 20.0, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 09:55:03.285499
301	2	3	qc	create_test	quality_test	33	{"batch_id": "HC-2-632-9218BD", "element_id": 25, "age_days": 1, "passed": true, "avg_strength_mpa": 21.666666666666668, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 09:55:18.737172
302	2	3	qc	create_test	quality_test	34	{"batch_id": "HC-2-633-ACCB4C", "element_id": 26, "age_days": 1, "passed": true, "avg_strength_mpa": 21.333333333333332, "required_strength_mpa": 20, "test_date": "2026-04-15"}	2026-04-15 09:55:37.603587
303	2	3	qc	create_test	quality_test	35	{"batch_id": "CUBE-20260408-2911-5EFB9E", "element_id": 8, "age_days": 7, "passed": false, "avg_strength_mpa": 42.0, "required_strength_mpa": 50, "test_date": "2026-04-15"}	2026-04-15 09:56:24.083155
304	2	3	qc	create_test	quality_test	36	{"batch_id": "CUBE-20260408-3696-A68BE9", "element_id": 10, "age_days": 7, "passed": true, "avg_strength_mpa": 41.666666666666664, "required_strength_mpa": 40, "test_date": "2026-04-15"}	2026-04-15 09:56:48.202099
305	2	3	qc	create_test	quality_test	37	{"batch_id": "CUBE-20260408-3697-E1CDB4", "element_id": 10, "age_days": 7, "passed": true, "avg_strength_mpa": 41.0, "required_strength_mpa": 40, "test_date": "2026-04-15"}	2026-04-15 09:57:11.858194
306	2	3	qc	create_test	quality_test	38	{"batch_id": "HC-2-18-15C102", "element_id": 11, "age_days": 7, "passed": true, "avg_strength_mpa": 36.0, "required_strength_mpa": 35, "test_date": "2026-04-15"}	2026-04-15 09:58:12.664132
309	2	3	hollowcore	mark_cut	hollowcore_cast	629	{"element_id": 25, "batch_id": "HC-2-629-507CF3", "cast_date": "2026-04-15", "bed_id": 2, "cast_slot_index": 0, "quantity": 16}	2026-04-15 10:00:02.271903
307	2	3	qc	create_test	quality_test	39	{"batch_id": "HC-2-19-94DABA", "element_id": 11, "age_days": 7, "passed": true, "avg_strength_mpa": 35.333333333333336, "required_strength_mpa": 35, "test_date": "2026-04-15"}	2026-04-15 09:59:03.587513
308	2	3	qc	create_test	quality_test	40	{"batch_id": "HC-2-20-938ECE", "element_id": 11, "age_days": 7, "passed": true, "avg_strength_mpa": 36.333333333333336, "required_strength_mpa": 35, "test_date": "2026-04-15"}	2026-04-15 09:59:23.015818
312	2	3	hollowcore	mark_cut	hollowcore_cast	632	{"element_id": 25, "batch_id": "HC-2-632-9218BD", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 0, "quantity": 6}	2026-04-15 10:00:10.156032
316	2	3	hollowcore	complete_cast	hollowcore_cast	631	{"element_id": 25, "batch_id": "HC-2-631-F3B0F7", "cast_date": "2026-04-15", "bed_id": 4, "cast_slot_index": 0, "quantity": 16, "location_id": 2}	2026-04-15 10:00:38.425703
310	2	3	hollowcore	mark_cut	hollowcore_cast	630	{"element_id": 25, "batch_id": "HC-2-630-F371E6", "cast_date": "2026-04-15", "bed_id": 3, "cast_slot_index": 0, "quantity": 16}	2026-04-15 10:00:04.145681
318	2	3	hollowcore	complete_cast	hollowcore_cast	633	{"element_id": 26, "batch_id": "HC-2-633-ACCB4C", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 1, "quantity": 15, "location_id": 2}	2026-04-15 10:00:38.636986
311	2	3	hollowcore	mark_cut	hollowcore_cast	631	{"element_id": 25, "batch_id": "HC-2-631-F3B0F7", "cast_date": "2026-04-15", "bed_id": 4, "cast_slot_index": 0, "quantity": 16}	2026-04-15 10:00:06.877877
317	2	3	hollowcore	complete_cast	hollowcore_cast	632	{"element_id": 25, "batch_id": "HC-2-632-9218BD", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 0, "quantity": 6, "location_id": 2}	2026-04-15 10:00:38.529976
313	2	3	hollowcore	mark_cut	hollowcore_cast	633	{"element_id": 26, "batch_id": "HC-2-633-ACCB4C", "cast_date": "2026-04-15", "bed_id": 5, "cast_slot_index": 1, "quantity": 15}	2026-04-15 10:00:11.634171
315	2	3	hollowcore	complete_cast	hollowcore_cast	630	{"element_id": 25, "batch_id": "HC-2-630-F371E6", "cast_date": "2026-04-15", "bed_id": 3, "cast_slot_index": 0, "quantity": 16, "location_id": 2}	2026-04-15 10:00:38.319359
314	2	3	hollowcore	complete_cast	hollowcore_cast	629	{"element_id": 25, "batch_id": "HC-2-629-507CF3", "cast_date": "2026-04-15", "bed_id": 2, "cast_slot_index": 0, "quantity": 16, "location_id": 2}	2026-04-15 10:00:38.202975
319	2	3	elements	update_element	element	4	{"element_mark": "test 1 Hollow walling ", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:21:55.838663
320	2	3	elements	update_element	element	5	{"element_mark": "test walling 2", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:04.43695
321	2	3	elements	update_element	element	27	{"element_mark": "walling ( test fail Units test)", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:13.587766
322	2	3	elements	update_element	element	26	{"element_mark": "first floor slabs ", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:19.518233
323	2	3	elements	update_element	element	25	{"element_mark": "walling HC 3", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:28.881836
324	2	3	elements	update_element	element	24	{"element_mark": "HC 455", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:37.805603
325	2	3	elements	update_element	element	23	{"element_mark": "Hcbb", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:45.773899
326	2	3	elements	update_element	element	22	{"element_mark": "HCC", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:54.167656
327	2	3	elements	update_element	element	13	{"element_mark": "Hc 1", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:22:59.66758
328	2	3	elements	update_element	element	12	{"element_mark": "walling 500 TQ", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:23:04.849453
329	2	3	elements	update_element	element	11	{"element_mark": "Walling 500cf", "updated_fields": ["due_date", "element_mark", "mix_design_id", "panel_length_mm", "quantity", "slab_thickness_mm"]}	2026-04-15 10:23:08.848645
\.


--
-- Data for Name: yard_inventory; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.yard_inventory (id, factory_id, element_id, location_id, quantity) FROM stdin;
15	2	22	2	15
16	2	23	2	12
17	2	24	2	20
19	2	12	2	84
11	2	2	2	6
12	2	3	2	3
13	2	8	2	3
14	2	10	2	8
20	2	27	2	30
18	2	25	2	150
21	2	26	2	15
1	2	1	1	0
4	2	5	1	15
3	2	4	1	20
8	2	11	1	100
5	2	2	1	8
7	2	10	1	9
6	2	8	1	3
2	2	3	1	0
10	2	13	1	1
\.


--
-- Data for Name: yard_locations; Type: TABLE DATA; Schema: public; Owner: precast
--

COPY public.yard_locations (id, name, factory_id, description) FROM stdin;
1	hollowcore yard A	2	Behind silo 10
2	Block B	2	near silo 10
\.


--
-- Name: dispatch_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.dispatch_items_id_seq', 13, true);


--
-- Name: dispatch_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.dispatch_orders_id_seq', 8, true);


--
-- Name: element_moulds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.element_moulds_id_seq', 13, true);


--
-- Name: elements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.elements_id_seq', 28, true);


--
-- Name: factories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.factories_id_seq', 2, true);


--
-- Name: hollowcore_beds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.hollowcore_beds_id_seq', 10, true);


--
-- Name: hollowcore_casts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.hollowcore_casts_id_seq', 673, true);


--
-- Name: hollowcore_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.hollowcore_settings_id_seq', 2, true);


--
-- Name: mix_designs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.mix_designs_id_seq', 4, true);


--
-- Name: moulds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.moulds_id_seq', 6, true);


--
-- Name: planner_delays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.planner_delays_id_seq', 6, true);


--
-- Name: production_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.production_schedule_id_seq', 16465, true);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.projects_id_seq', 3, true);


--
-- Name: quality_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.quality_tests_id_seq', 40, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: wetcasting_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.wetcasting_activity_id_seq', 329, true);


--
-- Name: yard_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.yard_inventory_id_seq', 21, true);


--
-- Name: yard_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: precast
--

SELECT pg_catalog.setval('public.yard_locations_id_seq', 2, true);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: dispatch_items dispatch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_pkey PRIMARY KEY (id);


--
-- Name: dispatch_orders dispatch_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_pkey PRIMARY KEY (id);


--
-- Name: element_moulds element_moulds_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.element_moulds
    ADD CONSTRAINT element_moulds_pkey PRIMARY KEY (id);


--
-- Name: elements elements_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_pkey PRIMARY KEY (id);


--
-- Name: factories factories_name_key; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.factories
    ADD CONSTRAINT factories_name_key UNIQUE (name);


--
-- Name: factories factories_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.factories
    ADD CONSTRAINT factories_pkey PRIMARY KEY (id);


--
-- Name: hollowcore_beds hollowcore_beds_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_beds
    ADD CONSTRAINT hollowcore_beds_pkey PRIMARY KEY (id);


--
-- Name: hollowcore_casts hollowcore_casts_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts
    ADD CONSTRAINT hollowcore_casts_pkey PRIMARY KEY (id);


--
-- Name: hollowcore_settings hollowcore_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_settings
    ADD CONSTRAINT hollowcore_settings_pkey PRIMARY KEY (id);


--
-- Name: mix_designs mix_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.mix_designs
    ADD CONSTRAINT mix_designs_pkey PRIMARY KEY (id);


--
-- Name: moulds moulds_name_key; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.moulds
    ADD CONSTRAINT moulds_name_key UNIQUE (name);


--
-- Name: moulds moulds_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.moulds
    ADD CONSTRAINT moulds_pkey PRIMARY KEY (id);


--
-- Name: planner_delays planner_delays_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays
    ADD CONSTRAINT planner_delays_pkey PRIMARY KEY (id);


--
-- Name: production_schedule production_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule
    ADD CONSTRAINT production_schedule_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quality_tests quality_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_pkey PRIMARY KEY (id);


--
-- Name: element_moulds uq_element_mould; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.element_moulds
    ADD CONSTRAINT uq_element_mould UNIQUE (element_id, mould_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: wetcasting_activity wetcasting_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.wetcasting_activity
    ADD CONSTRAINT wetcasting_activity_pkey PRIMARY KEY (id);


--
-- Name: yard_inventory yard_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory
    ADD CONSTRAINT yard_inventory_pkey PRIMARY KEY (id);


--
-- Name: yard_locations yard_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_locations
    ADD CONSTRAINT yard_locations_pkey PRIMARY KEY (id);


--
-- Name: ix_dispatch_items_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_dispatch_items_id ON public.dispatch_items USING btree (id);


--
-- Name: ix_dispatch_orders_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_dispatch_orders_factory_id ON public.dispatch_orders USING btree (factory_id);


--
-- Name: ix_dispatch_orders_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_dispatch_orders_id ON public.dispatch_orders USING btree (id);


--
-- Name: ix_dispatch_orders_status_changed_by; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_dispatch_orders_status_changed_by ON public.dispatch_orders USING btree (status_changed_by);


--
-- Name: ix_element_mould_element_mould; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_element_mould_element_mould ON public.element_moulds USING btree (element_id, mould_id);


--
-- Name: ix_element_moulds_element_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_element_moulds_element_id ON public.element_moulds USING btree (element_id);


--
-- Name: ix_element_moulds_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_element_moulds_id ON public.element_moulds USING btree (id);


--
-- Name: ix_element_moulds_mould_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_element_moulds_mould_id ON public.element_moulds USING btree (mould_id);


--
-- Name: ix_elements_active; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_active ON public.elements USING btree (active);


--
-- Name: ix_elements_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_factory_id ON public.elements USING btree (factory_id);


--
-- Name: ix_elements_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_id ON public.elements USING btree (id);


--
-- Name: ix_elements_mix_design_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_mix_design_id ON public.elements USING btree (mix_design_id);


--
-- Name: ix_elements_project_due; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_project_due ON public.elements USING btree (project_id, due_date);


--
-- Name: ix_elements_project_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_project_id ON public.elements USING btree (project_id);


--
-- Name: ix_elements_status; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_elements_status ON public.elements USING btree (status);


--
-- Name: ix_factories_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_factories_id ON public.factories USING btree (id);


--
-- Name: ix_hollowcore_beds_active; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_beds_active ON public.hollowcore_beds USING btree (active);


--
-- Name: ix_hollowcore_beds_factory_active; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_beds_factory_active ON public.hollowcore_beds USING btree (factory_id, active);


--
-- Name: ix_hollowcore_beds_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_beds_factory_id ON public.hollowcore_beds USING btree (factory_id);


--
-- Name: ix_hollowcore_beds_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_beds_id ON public.hollowcore_beds USING btree (id);


--
-- Name: ix_hollowcore_cast_unique_slot; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX ix_hollowcore_cast_unique_slot ON public.hollowcore_casts USING btree (cast_date, bed_number, cast_slot_index);


--
-- Name: ix_hollowcore_cast_unique_slot_v2; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_cast_unique_slot_v2 ON public.hollowcore_casts USING btree (cast_date, bed_id, cast_slot_index);


--
-- Name: ix_hollowcore_casts_batch_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_batch_id ON public.hollowcore_casts USING btree (batch_id);


--
-- Name: ix_hollowcore_casts_bed_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_bed_id ON public.hollowcore_casts USING btree (bed_id);


--
-- Name: ix_hollowcore_casts_cast_date; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_cast_date ON public.hollowcore_casts USING btree (cast_date);


--
-- Name: ix_hollowcore_casts_element_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_element_id ON public.hollowcore_casts USING btree (element_id);


--
-- Name: ix_hollowcore_casts_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_factory_id ON public.hollowcore_casts USING btree (factory_id);


--
-- Name: ix_hollowcore_casts_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_id ON public.hollowcore_casts USING btree (id);


--
-- Name: ix_hollowcore_casts_status; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_casts_status ON public.hollowcore_casts USING btree (status);


--
-- Name: ix_hollowcore_casts_unique_slot_v2; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX ix_hollowcore_casts_unique_slot_v2 ON public.hollowcore_casts USING btree (cast_date, bed_id, cast_slot_index) WHERE (bed_id IS NOT NULL);


--
-- Name: ix_hollowcore_settings_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_settings_factory_id ON public.hollowcore_settings USING btree (factory_id);


--
-- Name: ix_hollowcore_settings_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_hollowcore_settings_id ON public.hollowcore_settings USING btree (id);


--
-- Name: ix_mix_designs_active; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_mix_designs_active ON public.mix_designs USING btree (active);


--
-- Name: ix_mix_designs_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_mix_designs_factory_id ON public.mix_designs USING btree (factory_id);


--
-- Name: ix_mix_designs_factory_id_name; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX ix_mix_designs_factory_id_name ON public.mix_designs USING btree (factory_id, name);


--
-- Name: ix_mix_designs_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_mix_designs_id ON public.mix_designs USING btree (id);


--
-- Name: ix_moulds_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_moulds_factory_id ON public.moulds USING btree (factory_id);


--
-- Name: ix_moulds_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_moulds_id ON public.moulds USING btree (id);


--
-- Name: ix_planner_delays_bed_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_bed_id ON public.planner_delays USING btree (bed_id);


--
-- Name: ix_planner_delays_created_by; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_created_by ON public.planner_delays USING btree (created_by);


--
-- Name: ix_planner_delays_delay_date; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_delay_date ON public.planner_delays USING btree (delay_date);


--
-- Name: ix_planner_delays_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_factory_id ON public.planner_delays USING btree (factory_id);


--
-- Name: ix_planner_delays_factory_type_date; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_factory_type_date ON public.planner_delays USING btree (factory_id, planner_type, delay_date);


--
-- Name: ix_planner_delays_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_id ON public.planner_delays USING btree (id);


--
-- Name: ix_planner_delays_mould_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_mould_id ON public.planner_delays USING btree (mould_id);


--
-- Name: ix_planner_delays_planner_type; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_planner_delays_planner_type ON public.planner_delays USING btree (planner_type);


--
-- Name: ix_production_mould_date; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_mould_date ON public.production_schedule USING btree (mould_id, production_date);


--
-- Name: ix_production_schedule_batch_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_schedule_batch_id ON public.production_schedule USING btree (batch_id);


--
-- Name: ix_production_schedule_element_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_schedule_element_id ON public.production_schedule USING btree (element_id);


--
-- Name: ix_production_schedule_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_schedule_factory_id ON public.production_schedule USING btree (factory_id);


--
-- Name: ix_production_schedule_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_schedule_id ON public.production_schedule USING btree (id);


--
-- Name: ix_production_schedule_mould_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_schedule_mould_id ON public.production_schedule USING btree (mould_id);


--
-- Name: ix_production_status; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_production_status ON public.production_schedule USING btree (status);


--
-- Name: ix_projects_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_projects_factory_id ON public.projects USING btree (factory_id);


--
-- Name: ix_projects_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_projects_id ON public.projects USING btree (id);


--
-- Name: ix_projects_status; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_projects_status ON public.projects USING btree (status);


--
-- Name: ix_quality_batch; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_batch ON public.quality_tests USING btree (batch_id);


--
-- Name: ix_quality_element_date; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_element_date ON public.quality_tests USING btree (element_id, test_date);


--
-- Name: ix_quality_tests_batch_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_tests_batch_id ON public.quality_tests USING btree (batch_id);


--
-- Name: ix_quality_tests_element_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_tests_element_id ON public.quality_tests USING btree (element_id);


--
-- Name: ix_quality_tests_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_tests_id ON public.quality_tests USING btree (id);


--
-- Name: ix_quality_tests_mix_design_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_quality_tests_mix_design_id ON public.quality_tests USING btree (mix_design_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_users_factory_id ON public.users USING btree (factory_id);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: ix_wetcasting_activity_created_at; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_created_at ON public.wetcasting_activity USING btree (created_at);


--
-- Name: ix_wetcasting_activity_factory_created; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_factory_created ON public.wetcasting_activity USING btree (factory_id, created_at);


--
-- Name: ix_wetcasting_activity_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_factory_id ON public.wetcasting_activity USING btree (factory_id);


--
-- Name: ix_wetcasting_activity_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_id ON public.wetcasting_activity USING btree (id);


--
-- Name: ix_wetcasting_activity_section; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_section ON public.wetcasting_activity USING btree (section);


--
-- Name: ix_wetcasting_activity_user_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_wetcasting_activity_user_id ON public.wetcasting_activity USING btree (user_id);


--
-- Name: ix_yard_inventory_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_yard_inventory_factory_id ON public.yard_inventory USING btree (factory_id);


--
-- Name: ix_yard_inventory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_yard_inventory_id ON public.yard_inventory USING btree (id);


--
-- Name: ix_yard_locations_factory_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_yard_locations_factory_id ON public.yard_locations USING btree (factory_id);


--
-- Name: ix_yard_locations_factory_id_name; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX ix_yard_locations_factory_id_name ON public.yard_locations USING btree (factory_id, name);


--
-- Name: ix_yard_locations_id; Type: INDEX; Schema: public; Owner: precast
--

CREATE INDEX ix_yard_locations_id ON public.yard_locations USING btree (id);


--
-- Name: uq_quality_tests_batch_age; Type: INDEX; Schema: public; Owner: precast
--

CREATE UNIQUE INDEX uq_quality_tests_batch_age ON public.quality_tests USING btree (batch_id, age_days) WHERE ((batch_id IS NOT NULL) AND (age_days IS NOT NULL));


--
-- Name: dispatch_items dispatch_items_dispatch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_dispatch_id_fkey FOREIGN KEY (dispatch_id) REFERENCES public.dispatch_orders(id);


--
-- Name: dispatch_items dispatch_items_yard_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_items
    ADD CONSTRAINT dispatch_items_yard_inventory_id_fkey FOREIGN KEY (yard_inventory_id) REFERENCES public.yard_inventory(id);


--
-- Name: dispatch_orders dispatch_orders_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: dispatch_orders dispatch_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: dispatch_orders dispatch_orders_status_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT dispatch_orders_status_changed_by_fkey FOREIGN KEY (status_changed_by) REFERENCES public.users(id);


--
-- Name: element_moulds element_moulds_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.element_moulds
    ADD CONSTRAINT element_moulds_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: element_moulds element_moulds_mould_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.element_moulds
    ADD CONSTRAINT element_moulds_mould_id_fkey FOREIGN KEY (mould_id) REFERENCES public.moulds(id) ON DELETE RESTRICT;


--
-- Name: elements elements_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: elements elements_mix_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_mix_design_id_fkey FOREIGN KEY (mix_design_id) REFERENCES public.mix_designs(id) ON DELETE SET NULL;


--
-- Name: elements elements_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT elements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: dispatch_orders fk_dispatch_orders_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.dispatch_orders
    ADD CONSTRAINT fk_dispatch_orders_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: elements fk_elements_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT fk_elements_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: elements fk_elements_mix_design_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.elements
    ADD CONSTRAINT fk_elements_mix_design_id FOREIGN KEY (mix_design_id) REFERENCES public.mix_designs(id) ON DELETE SET NULL;


--
-- Name: hollowcore_settings fk_hollowcore_settings_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_settings
    ADD CONSTRAINT fk_hollowcore_settings_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: mix_designs fk_mix_designs_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.mix_designs
    ADD CONSTRAINT fk_mix_designs_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: moulds fk_moulds_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.moulds
    ADD CONSTRAINT fk_moulds_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: production_schedule fk_production_schedule_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule
    ADD CONSTRAINT fk_production_schedule_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: projects fk_projects_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fk_projects_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: quality_tests fk_quality_tests_mix_design_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT fk_quality_tests_mix_design_id FOREIGN KEY (mix_design_id) REFERENCES public.mix_designs(id) ON DELETE SET NULL;


--
-- Name: users fk_users_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: yard_inventory fk_yard_inventory_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory
    ADD CONSTRAINT fk_yard_inventory_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: yard_locations fk_yard_locations_factory_id; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_locations
    ADD CONSTRAINT fk_yard_locations_factory_id FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: hollowcore_beds hollowcore_beds_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_beds
    ADD CONSTRAINT hollowcore_beds_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: hollowcore_casts hollowcore_casts_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts
    ADD CONSTRAINT hollowcore_casts_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.hollowcore_beds(id);


--
-- Name: hollowcore_casts hollowcore_casts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts
    ADD CONSTRAINT hollowcore_casts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: hollowcore_casts hollowcore_casts_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts
    ADD CONSTRAINT hollowcore_casts_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: hollowcore_casts hollowcore_casts_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_casts
    ADD CONSTRAINT hollowcore_casts_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: hollowcore_settings hollowcore_settings_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.hollowcore_settings
    ADD CONSTRAINT hollowcore_settings_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: mix_designs mix_designs_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.mix_designs
    ADD CONSTRAINT mix_designs_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: moulds moulds_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.moulds
    ADD CONSTRAINT moulds_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: planner_delays planner_delays_bed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays
    ADD CONSTRAINT planner_delays_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.hollowcore_beds(id) ON DELETE CASCADE;


--
-- Name: planner_delays planner_delays_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays
    ADD CONSTRAINT planner_delays_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: planner_delays planner_delays_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays
    ADD CONSTRAINT planner_delays_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: planner_delays planner_delays_mould_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.planner_delays
    ADD CONSTRAINT planner_delays_mould_id_fkey FOREIGN KEY (mould_id) REFERENCES public.moulds(id) ON DELETE CASCADE;


--
-- Name: production_schedule production_schedule_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule
    ADD CONSTRAINT production_schedule_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: production_schedule production_schedule_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule
    ADD CONSTRAINT production_schedule_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: production_schedule production_schedule_mould_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.production_schedule
    ADD CONSTRAINT production_schedule_mould_id_fkey FOREIGN KEY (mould_id) REFERENCES public.moulds(id) ON DELETE RESTRICT;


--
-- Name: projects projects_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: quality_tests quality_tests_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id) ON DELETE CASCADE;


--
-- Name: quality_tests quality_tests_mix_design_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.quality_tests
    ADD CONSTRAINT quality_tests_mix_design_id_fkey FOREIGN KEY (mix_design_id) REFERENCES public.mix_designs(id) ON DELETE SET NULL;


--
-- Name: users users_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: wetcasting_activity wetcasting_activity_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.wetcasting_activity
    ADD CONSTRAINT wetcasting_activity_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: wetcasting_activity wetcasting_activity_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.wetcasting_activity
    ADD CONSTRAINT wetcasting_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: yard_inventory yard_inventory_element_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory
    ADD CONSTRAINT yard_inventory_element_id_fkey FOREIGN KEY (element_id) REFERENCES public.elements(id);


--
-- Name: yard_inventory yard_inventory_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory
    ADD CONSTRAINT yard_inventory_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- Name: yard_inventory yard_inventory_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_inventory
    ADD CONSTRAINT yard_inventory_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.yard_locations(id);


--
-- Name: yard_locations yard_locations_factory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: precast
--

ALTER TABLE ONLY public.yard_locations
    ADD CONSTRAINT yard_locations_factory_id_fkey FOREIGN KEY (factory_id) REFERENCES public.factories(id);


--
-- PostgreSQL database dump complete
--

\unrestrict K36viiCEfLgn8jOI3pbEGzXLSywiZe1ehscOacwncA8K5U77EspEeV6s0RnmVlu

