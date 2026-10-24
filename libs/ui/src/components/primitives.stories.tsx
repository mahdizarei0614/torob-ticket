import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Mode } from '@torob-ticket/contracts';
import { Button } from './button';
import { ComboBox } from './combobox';
import { Dialog } from './dialog';
import { Price } from './price';
import { SegmentedControl } from './segmented-control';
import { Status, type StatusTone } from './status';
import { Tooltip } from './tooltip';
import { Code, type Language } from './language';
import { ThemeProvider, useTheme, type Appearance } from '../theme/theme-provider';
import '../styles/index.css';
import styles from './gallery.module.css';

function TransportIcon({ mode }: { mode: Mode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === 'flight' ? (
        <path d="m3 13 7-2 1-8h2l1 8 7 2v2l-7-1v5l3 2H7l3-2v-5l-7 1z" />
      ) : (
        <>
          <rect x="5" y="3" width="14" height="16" rx="3" />
          <path d="M5 11h14M9 6h6M8 15h1m6 0h1M8 19l-2 3m10-3 2 3" />
          {mode === 'bus' && <path d="M2 7v5m20-5v5" />}
        </>
      )}
    </svg>
  );
}
function GalleryContent({ language, mode }: { language: Language; mode: Mode }) {
  const fa = language === 'fa';
  const text = (persian: string, english: string) => (fa ? persian : english);
  const theme = useTheme();
  const [transport, setTransport] = useState<string>(mode);
  const [origin, setOrigin] = useState<string | null>('thr');
  const [originInput, setOriginInput] = useState(text('تهران', 'Tehran'));
  const [destination, setDestination] = useState<string | null>('mhd');
  const [destinationInput, setDestinationInput] = useState(text('مشهد', 'Mashhad'));
  const [dialog, setDialog] = useState(false);
  const [trip, setTrip] = useState('one-way');
  const [emptyInput, setEmptyInput] = useState('');
  const items = [
    { id: 'thr', label: text('تهران', 'Tehran'), code: 'THR' },
    { id: 'mhd', label: text('مشهد', 'Mashhad'), code: 'MHD' },
    { id: 'syz', label: text('شیراز', 'Shiraz'), code: 'SYZ' },
  ];
  const modes = [
    { id: 'flight', label: text('پرواز', 'Flight'), icon: <TransportIcon mode="flight" /> },
    { id: 'train', label: text('قطار', 'Train'), icon: <TransportIcon mode="train" /> },
    { id: 'bus', label: text('اتوبوس', 'Bus'), icon: <TransportIcon mode="bus" /> },
  ];
  const statuses: { tone: StatusTone; label: string }[] = [
    { tone: 'success', label: text('قیمت کامل', 'Complete total') },
    { tone: 'info', label: text('در حال بررسی', 'Checking providers') },
    { tone: 'warning', label: text('بخشی از نتایج', 'Partial coverage') },
    { tone: 'danger', label: text('قیمت نامشخص', 'Price unavailable') },
    { tone: 'neutral', label: text('بدون نتیجه', 'No matching offers') },
  ];
  return (
    <main className={styles.gallery}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>{text('ترب تیکت', 'TorobTicket')}</strong>
          <span className={styles.divider} />
          <span className={styles.small}>{text('مقایسه سفر', 'Travel comparison')}</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.edition}>
            <Code>T12 / UI STUDY</Code>
          </span>
          <Button
            language={language}
            variant="secondary"
            onPress={() =>
              theme.setPreference(
                theme.appearance === 'light' ? 'dark' : 'light',
                document.activeElement as HTMLElement,
              )
            }
          >
            {theme.appearance === 'light' ? text('حالت تیره', 'Dark mode') : text('حالت روشن', 'Light mode')}
          </Button>
        </div>
      </header>
      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>
            {text('کمتر جست‌وجو کن، بهتر مقایسه کن', 'LESS SEARCHING. CLEARER CHOICES.')}
          </p>
          <h1>{text('مسیر روشن، انتخاب مطمئن', 'A clearer way to compare.')}</h1>
          <p className={styles.muted}>
            {text(
              'گالری اجزای رابط · داده‌ها نمونه‌اند و خرید یا رزروی انجام نمی‌شود.',
              'Component review gallery · Sample data, no purchase or booking.',
            )}
          </p>
        </div>
        <span className={styles.paletteLabel}>
          <TransportIcon mode={mode} />
          <Code>
            {mode.toUpperCase()} / {theme.appearance.toUpperCase()}
          </Code>
        </span>
      </div>
      <section className={styles.searchPanel} aria-label={text('کنترل‌های جست‌وجو', 'Search controls')}>
        <div className={styles.searchTop}>
          <SegmentedControl
            label={text('نوع سفر', 'Transport')}
            language={language}
            value={transport}
            onChange={setTransport}
            options={modes}
          />
          <SegmentedControl
            label={text('رفت و برگشت', 'Journey')}
            language={language}
            value={trip}
            onChange={setTrip}
            options={[
              { id: 'one-way', label: text('یک‌طرفه', 'One way') },
              { id: 'return', label: text('رفت و برگشت', 'Round trip') },
            ]}
          />
        </div>
        <div className={styles.fields}>
          <ComboBox
            language={language}
            label={text('از کجا؟', 'From')}
            items={items}
            selectedKey={origin}
            onSelectionChange={setOrigin}
            inputValue={originInput}
            onInputChange={setOriginInput}
            description={text('شهر، فرودگاه یا ایستگاه', 'City, airport or station')}
          />
          <span className={styles.direction} aria-hidden="true">
            ⇄
          </span>
          <ComboBox
            language={language}
            label={text('به کجا؟', 'To')}
            items={items}
            selectedKey={destination}
            onSelectionChange={setDestination}
            inputValue={destinationInput}
            onInputChange={setDestinationInput}
            description={text('انتخاب از شبکه پشتیبانی‌شده', 'Choose from the supported network')}
          />
          <Button language={language} onPress={() => setDialog(true)}>
            {text('مشاهده نمونه قیمت', 'Inspect sample total')}
            <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </section>
      <div className={styles.reviewGrid}>
        <section className={styles.comparison} aria-labelledby="comparison-title">
          <div className={styles.sectionHeader}>
            <h2 id="comparison-title">{text('یک مسیر، قیمت شفاف', 'One journey. A transparent total.')}</h2>
            <Status language={language} tone="success">
              {text('مجموع همه مسافران', 'Whole-party total')}
            </Status>
          </div>
          <article className={styles.ticket}>
            <div className={styles.ticketTop}>
              <div className={styles.operator}>
                <span className={styles.vehicle}>
                  <TransportIcon mode={mode} />
                </span>
                <div>
                  <strong>{text('سفر آبی — نمایشی', 'Blue Journey — demo')}</strong>
                  <p className={styles.small}>
                    {text(
                      'نمونه کارت مقایسه · ارائه‌دهنده خیالی',
                      'Comparison specimen · Fictional provider',
                    )}
                  </p>
                </div>
              </div>
              <Tooltip
                language={language}
                content={text(
                  'هزینه‌های الزامی در مبلغ کل لحاظ شده‌اند.',
                  'All known mandatory charges are included.',
                )}
              >
                <Button
                  language={language}
                  variant="quiet"
                  aria-label={text('درباره مبلغ کل', 'About the total')}
                >
                  ⓘ
                </Button>
              </Tooltip>
            </div>
            <div className={styles.journey}>
              <div>
                <strong className={styles.time}>
                  <Code>08:30</Code>
                </strong>
                <p>{text('تهران', 'Tehran')}</p>
                <span className={styles.small}>
                  <Code>THR</Code>
                </span>
              </div>
              <div className={styles.route}>
                <span className={styles.small}>{text('۱ ساعت و ۳۰ دقیقه', '1h 30m')}</span>
                <div className={styles.routeLine}>
                  <i />
                  <span />
                  <TransportIcon mode={mode} />
                  <span />
                  <i />
                </div>
                <span className={styles.small}>{text('بدون تعویض وسیله', 'No vehicle change')}</span>
              </div>
              <div>
                <strong className={styles.time}>
                  <Code>10:00</Code>
                </strong>
                <p>{text('مشهد', 'Mashhad')}</p>
                <span className={styles.small}>
                  <Code>MHD</Code>
                </span>
              </div>
            </div>
            <div className={styles.ticketFooter}>
              <Price
                language={language}
                total={{ amountRial: 128500000, currency: 'IRR' }}
                scope={{ kind: 'party', travelers: 3 }}
              />
              <Button language={language} onPress={() => setDialog(true)}>
                {text('جزئیات مبلغ', 'Price details')}
                <span aria-hidden="true">←</span>
              </Button>
            </div>
            <p className={styles.conditions}>
              {text(
                'هزینه‌های الزامی محاسبه شده · شرایط لغو نامشخص',
                'Mandatory charges included · Cancellation conditions unknown',
              )}
            </p>
          </article>
          <p className={styles.annotation}>
            {text(
              'قیمت اولویت دارد؛ واحد، تعداد مسافر و شرایط همیشه در کنار آن می‌مانند.',
              'Price leads. Its unit, party size and conditions stay alongside it.',
            )}
          </p>
        </section>
        <section className={styles.statePanel} aria-labelledby="status-title">
          <div className={styles.sectionHeader}>
            <h2 id="status-title">{text('وضعیت‌ها، با معنا', 'States with meaning')}</h2>
            <span className={styles.small}>01—05</span>
          </div>
          <div className={styles.statusList}>
            {statuses.map((status, index) => (
              <div key={status.tone}>
                <span className={styles.small}>
                  <Code>0{index + 1}</Code>
                </span>
                <Status language={language} tone={status.tone}>
                  {status.label}
                </Status>
              </div>
            ))}
          </div>
          <p className={styles.annotation}>
            {text(
              'رنگ تنها نشانه نیست؛ متن و نماد وضعیت را توضیح می‌دهند.',
              'Text and symbols explain every state alongside its color.',
            )}
          </p>
        </section>
      </div>
      <section className={styles.stateSection} aria-labelledby="controls-title">
        <div className={styles.sectionHeader}>
          <h2 id="controls-title">{text('جزئیات تعامل', 'Interaction details')}</h2>
          <p className={styles.small}>{text('با Tab فوکوس را دنبال کنید', 'Use Tab to follow focus')}</p>
        </div>
        <div className={styles.stateColumns}>
          <div className={styles.sample}>
            <h3>{text('اقدام و انتظار', 'Action & progress')}</h3>
            <div className={styles.buttonStack}>
              <Button language={language}>{text('مقایسه قیمت‌ها', 'Compare prices')}</Button>
              <Button language={language} variant="secondary">
                {text('ویرایش جست‌وجو', 'Edit search')}
              </Button>
              <Button language={language} variant="quiet">
                {text('پاک کردن فیلترها', 'Clear filters')}
              </Button>
              <Button language={language} isLoading>
                {text('بررسی قیمت', 'Checking price')}
              </Button>
              <Button language={language} isDisabled>
                {text('فعلاً در دسترس نیست', 'Currently unavailable')}
              </Button>
            </div>
          </div>
          <div className={styles.sample}>
            <h3>{text('خطا، خالی و غیرفعال', 'Error, empty & disabled')}</h3>
            <ComboBox
              language={language}
              label={text('مقصد با خطا', 'Invalid destination')}
              items={items}
              selectedKey={null}
              onSelectionChange={() => undefined}
              inputValue={emptyInput}
              onInputChange={setEmptyInput}
              error={text('یک شهر پشتیبانی‌شده انتخاب کنید.', 'Choose a supported city.')}
            />
            <ComboBox
              language={language}
              label={text('بدون گزینه', 'Empty collection')}
              items={[]}
              selectedKey={null}
              onSelectionChange={() => undefined}
              inputValue={emptyInput}
              onInputChange={setEmptyInput}
            />
            <ComboBox
              language={language}
              label={text('دریافت شهرها', 'Loading cities')}
              items={[]}
              selectedKey={null}
              onSelectionChange={() => undefined}
              inputValue=""
              onInputChange={() => undefined}
              isLoading
              isDisabled
            />
            <SegmentedControl
              language={language}
              label={text('ظرفیت محدود', 'Restricted choice')}
              value="standard"
              onChange={() => undefined}
              options={[
                { id: 'standard', label: text('استاندارد', 'Standard') },
                { id: 'premium', label: text('ویژه', 'Premium'), disabled: true },
              ]}
            />
          </div>
          <div className={styles.sample}>
            <h3>{text('مبلغ اقامت و کدها', 'Stay total & identifiers')}</h3>
            <Price
              language={language}
              total={{ amountRial: 246000001, currency: 'IRR' }}
              scope={{ kind: 'stay', rooms: 2, nights: 3 }}
            />
            <p className={styles.small}>
              {text(
                'دقت یک ریال حفظ می‌شود؛ مبلغ برای کل اقامت است.',
                'One-rial precision retained. This covers the entire stay.',
              )}
            </p>
            <div className={styles.codeSample}>
              {text('مسیر', 'Route')} <Code>IKA → IST</Code>
              <br />
              {text('شناسه', 'Reference')} <Code>DEMO-TK-024</Code>
            </div>
            <Tooltip
              language={language}
              content={text(
                'راهنما با فوکوس صفحه‌کلید هم نمایش داده می‌شود.',
                'This tooltip also appears on keyboard focus.',
              )}
            >
              <Button language={language} variant="secondary">
                {text('راهنمای دسترس‌پذیر', 'Keyboard tooltip')}
              </Button>
            </Tooltip>
            <Button language={language} variant="quiet" onPress={() => theme.setPreference('system')}>
              {text('پیروی از تنظیم سیستم', 'Follow system appearance')}
            </Button>
          </div>
        </div>
      </section>
      <footer className={styles.footer}>
        <span>{text('بنیاد بصری ترب تیکت', 'TorobTicket visual foundation')}</span>
        <span>
          <Code>Vazirmatn / Inter · 44px targets · Local assets</Code>
        </span>
      </footer>
      <Dialog
        title={text('جزئیات مبلغ کل', 'Whole-party total')}
        language={language}
        isOpen={dialog}
        onOpenChange={setDialog}
        mobileFullscreen
      >
        <div className={styles.modalContent}>
          <Status language={language} tone="info">
            {text('نمونه نمایشی؛ بدون رزرو', 'Demo specimen; no booking')}
          </Status>
          <Price
            language={language}
            total={{ amountRial: 128500000, currency: 'IRR' }}
            scope={{ kind: 'party', travelers: 3 }}
          />
          <p>
            {text(
              'همه هزینه‌های الزامی شناخته‌شده در مجموع محاسبه شده‌اند. شرایط لغو نامشخص است.',
              'All known mandatory charges are included. Cancellation conditions are unknown.',
            )}
          </p>
          <dl className={styles.breakdown}>
            <div>
              <dt>{text('کرایه پایه', 'Base fare')}</dt>
              <dd>{text('۱۲٬۰۰۰٬۰۰۰ تومان', '12,000,000 toman')}</dd>
            </div>
            <div>
              <dt>{text('هزینه‌های الزامی', 'Mandatory charges')}</dt>
              <dd>{text('۸۵۰٬۰۰۰ تومان', '850,000 toman')}</dd>
            </div>
          </dl>
          <Button language={language} onPress={() => setDialog(false)}>
            {text('بازگشت به مقایسه', 'Back to comparison')}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
function FoundationGallery({
  language = 'fa',
  mode = 'flight',
  appearance = 'light',
  variant = 'consumer',
}: {
  language?: Language;
  mode?: Mode;
  appearance?: Appearance;
  variant?: 'consumer' | 'admin';
}) {
  return (
    <ThemeProvider
      key={`${mode}-${language}-${appearance}-${variant}`}
      language={language}
      mode={mode}
      variant={variant}
      initialPreference={appearance}
    >
      <GalleryContent language={language} mode={variant === 'admin' ? 'flight' : mode} />
    </ThemeProvider>
  );
}
const meta = {
  title: 'Foundation/All states',
  component: FoundationGallery,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    language: { control: 'radio', options: ['fa', 'en'] },
    mode: { control: 'radio', options: ['flight', 'train', 'bus'] },
    appearance: { control: 'radio', options: ['light', 'dark'] },
  },
} satisfies Meta<typeof FoundationGallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FlightLightPersian: Story = { args: { mode: 'flight', appearance: 'light', language: 'fa' } };
export const FlightDarkPersian: Story = { args: { mode: 'flight', appearance: 'dark', language: 'fa' } };
export const TrainLightPersian: Story = { args: { mode: 'train', appearance: 'light', language: 'fa' } };
export const TrainDarkPersian: Story = { args: { mode: 'train', appearance: 'dark', language: 'fa' } };
export const BusLightPersian: Story = { args: { mode: 'bus', appearance: 'light', language: 'fa' } };
export const BusDarkPersian: Story = { args: { mode: 'bus', appearance: 'dark', language: 'fa' } };
export const FlightLightEnglish: Story = { args: { mode: 'flight', appearance: 'light', language: 'en' } };
export const FlightDarkEnglish: Story = { args: { mode: 'flight', appearance: 'dark', language: 'en' } };
export const TrainLightEnglish: Story = { args: { mode: 'train', appearance: 'light', language: 'en' } };
export const TrainDarkEnglish: Story = { args: { mode: 'train', appearance: 'dark', language: 'en' } };
export const BusLightEnglish: Story = { args: { mode: 'bus', appearance: 'light', language: 'en' } };
export const BusDarkEnglish: Story = { args: { mode: 'bus', appearance: 'dark', language: 'en' } };
export const AdminLight: Story = { args: { variant: 'admin', appearance: 'light', language: 'en' } };
export const AdminDark: Story = { args: { variant: 'admin', appearance: 'dark', language: 'en' } };
