import { LuCalendarClock, LuChartColumn, LuFlame } from 'react-icons/lu';
import { site } from '../../config/site';
import { useL, useT } from '../../i18n';
import { Seo } from '../../lib/head';
import { TradingViewWidget } from '../../components/tools/TradingViewWidget';
import { ButtonLink } from '../../components/ui/Button';
import { Notice } from '../../components/ui/Feedback';
import { Feature, PageHero, Section, SectionHeading } from '../../components/ui/Section';

export default function EconomicCalendar() {
  const L = useL();
  const t = useT();
  return (
    <>
      <Seo
        title={t.nav.tools.calendar[0]}
        description={L({ en: 'Upcoming economic releases and central bank events with forecasts and previous values.', ar: 'البيانات الاقتصادية وأحداث البنوك المركزية القادمة مع التوقعات والقيم السابقة.' })}
      />
      <PageHero
        crumbs={[{ label: t.nav.tools.label, to: '/tools' }, { label: t.nav.tools.calendar[0] }]}
        eyebrow={t.nav.tools.label}
        title={L({ en: 'Economic calendar', ar: 'المفكرة الاقتصادية' })}
        subtitle={L({
          en: 'The releases and decisions that move currencies, indices and gold, with forecasts and previous values. Times are shown in your local time zone.',
          ar: 'البيانات والقرارات التي تحرّك العملات والمؤشرات والذهب، مع التوقعات والقيم السابقة. تظهر الأوقات بتوقيتك المحلي.',
        })}
      />
      <Section className="pt-10 sm:pt-12 lg:pt-14">
        {site.features.economicCalendar && site.features.tradingViewWidgets ? (
          <TradingViewWidget kind="events" height={720} config={{ importanceFilter: '0,1', countryFilter: 'us,eu,gb,jp,ch,ca,au,nz,cn,sa,ae' }} />
        ) : (
          <Notice tone="info" title={L({ en: 'The live calendar is not shown right now', ar: 'المفكرة المباشرة غير معروضة حاليًا' })}>
            {L({ en: 'Release times, forecasts and results are published by major data providers every day. The guide below explains how to read them.', ar: 'تنشر مزوّدات البيانات الكبرى مواعيد البيانات وتوقعاتها ونتائجها يوميًا، ويشرح الدليل أدناه كيفية قراءتها.' })}
          </Notice>
        )}
      </Section>
      <Section className="pt-0 sm:pt-0 lg:pt-0">
        <SectionHeading title={L({ en: 'How to read the calendar', ar: 'كيف تقرأ المفكرة' })} />
        <div className="grid gap-4 md:grid-cols-3">
          <Feature icon={<LuFlame />} title={L({ en: 'Impact', ar: 'التأثير' })}>
            {L({ en: 'High-impact events such as central bank decisions, inflation and employment data tend to cause the largest moves and wider spreads.', ar: 'تميل الأحداث عالية التأثير مثل قرارات البنوك المركزية وبيانات التضخم والتوظيف إلى إحداث أكبر التحركات واتساع السبريد.' })}
          </Feature>
          <Feature icon={<LuChartColumn />} title={L({ en: 'Forecast vs actual', ar: 'التوقع مقابل الفعلي' })}>
            {L({ en: 'Markets react to surprises. A result far from the forecast usually matters more than the number itself.', ar: 'تتفاعل الأسواق مع المفاجآت، فالنتيجة البعيدة عن التوقعات تهم عادةً أكثر من الرقم نفسه.' })}
          </Feature>
          <Feature icon={<LuCalendarClock />} title={L({ en: 'Plan around it', ar: 'خطّط حولها' })}>
            {L({ en: 'Check the calendar before you trade, tighten risk into big releases and expect gaps around them.', ar: 'راجع المفكرة قبل التداول، وقلّل المخاطرة قبيل البيانات الكبرى، وتوقّع فجوات سعرية حولها.' })}
          </Feature>
        </div>
        <div className="mt-8 flex justify-center">
          <ButtonLink to="/blog/reading-the-economic-calendar" variant="secondary">
            {L({ en: 'Read the full guide', ar: 'اقرأ الدليل الكامل' })}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
