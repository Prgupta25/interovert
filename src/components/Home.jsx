import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import {
  MapPin,
  Download,
  QrCode,
  Users,
  Compass,
  Coffee,
  Headphones,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import a2 from '../assets/images/a2.jpg';
import a4 from '../assets/images/a4.jpg';
import a5 from '../assets/images/a5.jpg';
import a6 from '../assets/images/a6.jpg';
import a7 from '../assets/images/a7.jpg';
import a8 from '../assets/images/a8.jpg';
import a9 from '../assets/images/a9.jpg';
import a10 from '../assets/images/a10.jpg';
import a11 from '../assets/images/b3.jpg';
import p1 from '../assets/images/p1.jpg';
import p2 from '../assets/images/p2.jpg';
import p3 from '../assets/images/p3.jpg';
import p4 from '../assets/images/p4.jpg';
import p5 from '../assets/images/p5.jpg';
import p6 from '../assets/images/p7.jpg';
import b1 from '../assets/images/b7.jpg';
import b2 from '../assets/images/b8.jpg';
import b3 from '../assets/images/b5.jpg';
import b4 from '../assets/images/b6.jpg';
import b5 from '../assets/images/c3.jpg';

/** Hero backgrounds: warm meetups, quiet nature, small-group connection (zinc + indigo theme) */
const heroImages = [
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1920&q=82&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=82&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&q=82&auto=format&fit=crop',
];

const heroSlides = [
  {
    kicker: 'Your space to belong',
    line: 'Connect with fellow',
    highlight: 'introverts',
    sub: 'Find people who get your pace—through events built for real conversation, not small talk.',
  },
  {
    kicker: 'Low-pressure discovery',
    line: 'Explore quiet',
    highlight: 'adventures',
    sub: 'Cafés, walks, games, and gatherings chosen with introverts in mind.',
  },
  {
    kicker: 'On your terms',
    line: 'Grow at your',
    highlight: 'own pace',
    sub: 'Host or join events, chat when you’re ready, and build connections that feel authentic.',
  },
];

const features = [
  {
    title: 'Discover your tribe',
    description: 'Match with people who share your interests—without the noise of typical social apps.',
    image: a4,
    icon: Users,
  },
  {
    title: 'Quiet spaces',
    description: 'Browse cozy venues and low-key meetups designed for comfortable socializing.',
    image: a5,
    icon: Coffee,
  },
  {
    title: 'Mindful connections',
    description: 'Message, RSVP, and show up when it feels right. No pressure to perform.',
    image: a6,
    icon: Headphones,
  },
  {
    title: 'Room to recharge',
    description: 'Know what to expect upfront—so you can balance people time with downtime.',
    image: a7,
    icon: Compass,
  },
];

const interests = [
  { name: 'Book club', image: b1 },
  { name: 'Quiet cafés', image: b2 },
  { name: 'Nature walks', image: b3 },
  { name: 'Art & galleries', image: a2 },
  { name: 'Mindful moments', image: a7 },
  { name: 'Board games', image: a11 },
];

const tribes = [
  { name: 'Silent book club', image: b4 },
  { name: 'Introvert hikers', image: b3 },
  { name: 'Quiet game night', image: a9 },
  { name: 'Mindful art', image: a9 },
  { name: 'Film & discussion', image: a10 },
  { name: 'Calm tech meetups', image: a11 },
];

const destinations = [
  { name: 'Kyoto', image: p1 },
  { name: 'Edinburgh', image: p2 },
  { name: 'Vancouver', image: p3 },
  { name: 'Copenhagen', image: p4 },
  { name: 'Wellington', image: p5 },
  { name: 'Reykjavík', image: p6 },
];

const blogPosts = [
  { title: "The introvert's guide to meaningful connections", image: a8 },
  { title: 'Embracing solitude: the power of alone time', image: a9 },
  { title: 'Navigating social situations as an introvert', image: a10 },
  { title: 'Deep conversations in a noisy world', image: a11 },
];

function SectionHeading({ eyebrow, title, subtitle, className = '' }) {
  return (
    <div className={`mx-auto mb-12 max-w-3xl text-center ${className}`}>
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">{eyebrow}</p>
      ) : null}
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-base leading-relaxed text-zinc-400">{subtitle}</p> : null}
    </div>
  );
}

export default function Home() {
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const controls = useAnimation();
  const floatingTextRef = useRef(null);
  const destinationsScrollRef = useRef(null);

  const scrollDestinations = (direction) => {
    const el = destinationsScrollRef.current;
    if (!el) return;
    const firstCard = el.querySelector('[data-destination-card]');
    const gap = 20; // matches gap-5
    const step = firstCard ? firstCard.getBoundingClientRect().width + gap : Math.min(340, el.clientWidth * 0.9);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const navOffset = 84;
    const y = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          controls.start({
            x: ['100%', '-100%'],
            transition: { x: { repeat: Infinity, repeatType: 'loop', duration: 22, ease: 'linear' } },
          });
        } else {
          controls.stop();
        }
      },
      { threshold: 0.35 },
    );
    if (floatingTextRef.current) observer.observe(floatingTextRef.current);
    return () => {
      if (floatingTextRef.current) observer.unobserve(floatingTextRef.current);
    };
  }, [controls]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((p) => (p + 1) % heroImages.length);
    }, 5500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.replace('#', '');
    const section = document.getElementById(id);
    if (!section) return;
    const navOffset = 84;
    const y = section.getBoundingClientRect().top + window.pageYOffset - navOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, [location.hash]);

  const slide = heroSlides[currentSlide];

  return (
    <div className="relative overflow-x-hidden bg-zinc-950 font-sans text-zinc-100">
      {/* Hero */}
      <section className="relative min-h-[88vh] overflow-hidden pt-16">
        <div className="absolute inset-0">
          {heroImages.map((image, index) => (
            <motion.div
              key={index}
              initial={false}
              animate={{ opacity: currentSlide === index ? 1 : 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/55 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.2),transparent)]" />

        <div className="relative mx-auto flex min-h-[calc(88vh-4rem)] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl"
          >
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              {slide.kicker}
            </p>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {slide.line}{' '}
              <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
                {slide.highlight}
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 md:text-xl">{slide.sub}</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/events">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 sm:w-auto"
                >
                  Browse events
                  <ArrowRight className="h-5 w-5" />
                </motion.span>
              </Link>
              <button
                type="button"
                onClick={() => scrollToId('features')}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/10 sm:w-auto"
              >
                How it works
              </button>
            </div>
          </motion.div>

          <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2 sm:left-auto sm:right-8 sm:translate-x-0">
            {heroImages.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Slide ${index + 1}`}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  currentSlide === index ? 'w-8 bg-indigo-400' : 'w-2 bg-white/35 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.08),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Platform"
            title="Built for introverts"
            subtitle="Everything you need to find your people—without the overwhelm."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: index * 0.08 }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-zinc-950 ring-1 ring-white/[0.03] transition-shadow hover:border-zinc-700 hover:shadow-xl hover:shadow-indigo-950/20"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={feature.image}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:brightness-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 to-transparent" />
                  <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30 backdrop-blur-sm">
                    <feature.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Explore */}
      <section id="explore" className="border-y border-zinc-800/80 bg-zinc-900/30 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Interests"
            title="Explore what resonates"
            subtitle="Jump into categories you love—then see real events near you."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {interests.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 ring-1 ring-white/[0.02] transition-shadow hover:shadow-lg hover:shadow-black/40"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img src={item.image} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                </div>
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    Meet others who enjoy {item.name.toLowerCase()}—at a pace that suits you.
                  </p>
                  <Link
                    to="/events"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-400 transition hover:text-indigo-300"
                  >
                    View events
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Marquee */}
      <motion.div
        ref={floatingTextRef}
        className="border-y border-indigo-500/20 bg-gradient-to-r from-indigo-950/80 via-violet-950/60 to-indigo-950/80 py-6"
      >
        <motion.p
          animate={controls}
          className="whitespace-nowrap text-2xl font-bold tracking-[0.2em] text-white/25 sm:text-3xl md:text-4xl"
          style={{ x: '100%' }}
        >
          QUIET · CONNECT · RECHARGE · GROW · EXPLORE · FIND MY BUDDY
        </motion.p>
      </motion.div>

      {/* Community */}
      <section id="community" className="py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <SectionHeading
            eyebrow="Community"
            title="You’re not alone in preferring depth over noise"
            subtitle="Share wins, find accountability, and join a wider circle that respects boundaries—starting on WhatsApp."
          />
          <motion.a
            href="https://chat.whatsapp.com/HLOx1Kq79Ck3IHZWXfNZHm"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/30"
          >
            Join the community
            <ArrowRight className="h-5 w-5" />
          </motion.a>
        </div>
      </section>

      {/* Destinations */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Travel mindset"
            title="Introvert-friendly destinations"
            subtitle="Inspiration for your next slow trip—cities known for calm culture and space to breathe."
          />
          <div className="relative">
            <button
              type="button"
              aria-label="Scroll destinations left"
              onClick={() => scrollDestinations(-1)}
              className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-indigo-400/40 hover:bg-zinc-900 sm:flex lg:-left-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Scroll destinations right"
              onClick={() => scrollDestinations(1)}
              className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-950/90 text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:border-indigo-400/40 hover:bg-zinc-900 sm:flex lg:-right-2"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div
              ref={destinationsScrollRef}
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pt-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-14 [&::-webkit-scrollbar]:hidden"
            >
            {destinations.map((d, index) => (
              <motion.div
                key={d.name}
                data-destination-card
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="relative w-[min(85vw,320px)] shrink-0 snap-center overflow-hidden rounded-2xl border border-zinc-800 shadow-xl"
              >
                <img src={d.image} alt="" className="h-[380px] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-2xl font-bold text-white">{d.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
                    <MapPin className="h-4 w-4 text-indigo-400" />
                    On your list
                  </p>
                </div>
              </motion.div>
            ))}
            </div>
            <div className="mt-4 flex justify-center gap-3 sm:hidden">
              <button
                type="button"
                aria-label="Scroll destinations left"
                onClick={() => scrollDestinations(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-white backdrop-blur-sm transition active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Scroll destinations right"
                onClick={() => scrollDestinations(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-white backdrop-blur-sm transition active:scale-95"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Tribes */}
      <section className="border-t border-zinc-800/80 bg-zinc-900/20 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Groups"
            title="Find your tribe"
            subtitle="From silent reading to trail walks—these are the kinds of circles you can discover through events."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tribes.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 transition-shadow hover:shadow-lg hover:shadow-black/30"
              >
                <img src={item.image} alt="" className="aspect-[16/10] w-full object-cover" />
                <div className="p-5">
                  <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                  <p className="mt-2 text-sm text-zinc-500">See who’s hosting something similar near you.</p>
                  <Link to="/events">
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-400 hover:text-indigo-300">
                      Explore events
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section id="blog" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Read"
            title="Insights for introverts"
            subtitle="Short reads on connection, rest, and showing up authentically."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 ring-1 ring-white/[0.03] transition hover:border-zinc-700"
              >
                <div className="aspect-[5/4] overflow-hidden">
                  <img src={post.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-semibold leading-snug text-white">{post.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-zinc-500">Ideas and tips tailored to quieter personalities.</p>
                  <button
                    type="button"
                    onClick={() => scrollToId('blog')}
                    className="mt-4 text-left text-sm font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    Read more
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* App CTA */}
      <section className="border-t border-zinc-800 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-indigo-950/40 p-8 ring-1 ring-white/5 md:p-12 lg:flex lg:items-center lg:gap-12">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Mobile</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Take Find My Buddy with you
              </h2>
              <p className="mt-4 max-w-lg text-zinc-400">
                Same thoughtful experience on the go—browse events, get reminders, and stay in touch with your groups.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <div className="rounded-2xl border border-zinc-700 bg-white/5 p-4 backdrop-blur-sm">
                  <QrCode className="h-24 w-24 text-zinc-200" />
                </div>
                <div className="flex flex-col gap-3">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900"
                  >
                    <Download className="h-4 w-4" />
                    App Store
                  </motion.button>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
                  >
                    <Download className="h-4 w-4" />
                    Play Store
                  </motion.button>
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-1 justify-center lg:mt-0">
              <img
                src={b5}
                alt=""
                className="max-h-[420px] w-auto max-w-[280px] rounded-[2rem] border border-zinc-700/50 object-cover shadow-2xl shadow-black/50"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
