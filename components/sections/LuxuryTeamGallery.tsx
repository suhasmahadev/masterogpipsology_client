'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { TEAM_MEMBERS, type TeamMember } from '@/lib/content';
import { RevealText } from '@/components/motion/RevealText';
import { LightLeak } from '@/components/fx/LightLeak';
import { CurtainImage } from '@/components/fx/CurtainImage';
import { Parallax } from '@/components/fx/Parallax';
import { getLenis } from '@/components/providers/LenisProvider';

// Editorial asymmetric grid (lg): member 1 is a tall 4:5 portrait, the rest alternate
// span-4 (3:4) and span-3 (1:1) with a vertical offset on the odd ones.
function cardClasses(index: number): { col: string; aspect: string } {
  if (index === 0) return { col: 'lg:col-span-5 lg:row-span-2', aspect: 'aspect-[4/5]' };
  const i = index - 1;
  return i % 2 === 0
    ? { col: 'lg:col-span-4', aspect: 'aspect-[3/4]' }
    : { col: 'lg:col-span-3 lg:mt-24', aspect: 'aspect-square' };
}

export function LuxuryTeamGallery(): React.ReactElement {
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((member: TeamMember, el: HTMLElement) => {
    triggerRef.current = el;
    setSelectedMember(member);
  }, []);

  const close = useCallback(() => {
    setSelectedMember(null);
    const el = triggerRef.current;
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  return (
    <div
      id="team"
      className="relative w-full bg-[#08080A] text-[#F3ECE0] overflow-hidden"
      style={{
        // Zero gap with Burj Khalifa basement above
        marginTop: '-2px',
        paddingTop: '20px',
      }}
    >
      <LightLeak from="left" intensity={0.6} className="fx-leak--top" />
      {/* Deep atmospheric gold & obsidian ambient light */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 75% 35% at 50% 0%, rgba(212,175,55,0.09) 0%, transparent 65%),
            radial-gradient(circle 600px at 15% 40%, rgba(185,140,55,0.05) 0%, transparent 65%),
            radial-gradient(circle 700px at 85% 60%, rgba(212,175,55,0.04) 0%, transparent 70%)
          `,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-12 lg:px-16 pt-12 pb-28 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border text-xs font-body font-medium tracking-widest uppercase mb-4"
            style={{
              borderColor: 'rgba(212,175,55,0.4)',
              backgroundColor: 'rgba(212,175,55,0.08)',
              color: '#E8CA65',
              boxShadow: '0 0 20px rgba(212,175,55,0.15)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#E8CA65] animate-pulse" />
            The Institutional Faculty
          </motion.div>

          <RevealText
            as="h2"
            mode="lines"
            trigger="scroll"
            className="display max-w-3xl mb-4"
            style={{ fontSize: 'var(--fs-h2)', color: '#FAF6F0' }}
          >
            Architects of the framework.<br />
            <span className="italic bg-gradient-to-r from-[#F5E5C9] via-[#E2BE68] to-[#FAF1DE] bg-clip-text text-transparent">
              Mentors in live execution.
            </span>
          </RevealText>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg text-[#AEA699] font-body max-w-xl leading-relaxed mb-8"
          >
            Tactile 3D interactive dossier. Every mentor actively manages institutional capital and audits your live trades directly.
          </motion.p>
        </div>

        {/* ─── EDITORIAL FACULTY GRID ─── */}
        <div className="flex items-center gap-3 mb-8">
          <span className="label-caps" style={{ color: '#D4AF37' }}>
            Faculty Leadership
          </span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(212,175,55,0.25)' }} aria-hidden="true" />
        </div>

        <div className="faculty-grid grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-12 items-start">
          {TEAM_MEMBERS.map((member, index) => (
            <FacultyCard key={member.id} member={member} index={index} onInspect={open} />
          ))}
        </div>
      </div>

      <FacultyModal member={selectedMember} onClose={close} />
    </div>
  );
}

// ─── Editorial card ───
interface FacultyCardProps {
  member: TeamMember;
  index: number;
  onInspect: (member: TeamMember, el: HTMLElement) => void;
}

function FacultyCard({ member, index, onInspect }: FacultyCardProps): React.ReactElement {
  const { col, aspect } = cardClasses(index);
  return (
    <article className={`fc group relative ${col}`}>
      <button
        type="button"
        onClick={(e) => onInspect(member, e.currentTarget)}
        aria-haspopup="dialog"
        aria-label={`Open dossier: ${member.name}`}
        className="block w-full text-left cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
      >
        <motion.div
          layoutId={`fac-${member.id}`}
          className={`relative w-full overflow-hidden rounded-2xl bg-[#0A0A0C] border border-[#D4AF37]/25 ${aspect}`}
        >
          <CurtainImage className="absolute inset-0">
            <div className="fc-img relative h-full w-full">
              <Parallax speed={0.1} className="absolute inset-x-0 -inset-y-[8%]">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 40vw, 480px"
                  className="object-cover object-top"
                />
              </Parallax>
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080A]/70 via-transparent to-transparent" />
            </div>
          </CurtainImage>
        </motion.div>
      </button>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-body font-semibold mb-1">
          {member.title}
        </div>
        <h3 className="display font-medium text-2xl sm:text-3xl text-[#FAF6F0] tracking-tight">
          {member.name}
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-[#A8A196] font-body">{member.pedigree}</p>
      </div>
    </article>
  );
}

// ─── Dossier modal (shared-element image, focus trap, Esc, Lenis pause) ───
function FacultyModal({ member, onClose }: { member: TeamMember | null; onClose: () => void }): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const isOpen = member !== null;

  useEffect(() => {
    if (!isOpen) return;
    getLenis()?.stop();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      getLenis()?.start();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {member && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="faculty-dialog-title"
            initial={{ scale: 0.96, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl rounded-3xl bg-[#0F0F14] border border-[#D4AF37]/45 shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_50px_rgba(212,175,55,0.18)] overflow-hidden text-[#F5EFEB]"
          >
            {/* Top ambient gold accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent z-10" />

            {/* Close Button */}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close dossier"
              className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/[0.08] border border-white/[0.14] hover:bg-[#D4AF37]/20 hover:border-[#D4AF37]/60 flex items-center justify-center text-[#FAF1DE] transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div data-lenis-prevent className="grid grid-cols-1 md:grid-cols-12 max-h-[85vh] overflow-y-auto">
              <motion.div
                layoutId={`fac-${member.id}`}
                className="relative md:col-span-5 h-72 md:h-full min-h-[340px] bg-[#0A0A0C] overflow-hidden"
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                  className="object-cover object-top"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F14] md:bg-gradient-to-r md:from-transparent md:to-[#0F0F14] opacity-90" />
              </motion.div>

              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="inline-block px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest text-[#E8CA65] bg-[#D4AF37]/12 border border-[#D4AF37]/35 mb-3">
                    {member.pedigree}
                  </div>
                  <h3
                    id="faculty-dialog-title"
                    className="display font-medium text-3xl sm:text-4xl text-[#FBF8F3] tracking-tight mb-1"
                  >
                    {member.name}
                  </h3>
                  <p className="text-sm font-body text-[#D4AF37] mb-5">{member.role}</p>

                  <p className="text-sm sm:text-base text-[#C2BBB0] font-body leading-relaxed mb-6">{member.bio}</p>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] relative mb-6">
                    <span className="display text-3xl text-[#D4AF37]/35 absolute top-2 left-3 leading-none" aria-hidden="true">“</span>
                    <p className="text-xs sm:text-sm italic text-[#E5DDD0] pl-5 leading-relaxed">{member.quote}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {member.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg text-xs font-body bg-white/[0.04] border border-white/[0.08] text-[#D8D0C2]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-[#A59D91]">
                  <span>Focus: <strong className="text-[#FAF1DE]">{member.tags[0]}</strong></span>
                  <span>Discipline: <strong className="text-[#E8CA65]">{member.tags[1]}</strong></span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
