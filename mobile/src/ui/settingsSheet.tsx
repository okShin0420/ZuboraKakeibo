import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Bell, CalendarRange, Check, ChevronRight, DatabaseBackup, History, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { Settings } from '../repository/types';
import { privacyPolicyEffectiveDate, privacyPolicySections } from '../legal/privacyPolicy';
import { HOLIDAY_COVERAGE_NOTICE } from '../domain/period';
import { rangeLabel, yen } from './format';
import { colors } from './theme';
import { useBottomSheetMotion } from './useBottomSheetMotion';

function SettingSwitch({ value, disabled, label, onChange }: {
  value: boolean; disabled: boolean; label: string; onChange: (value: boolean) => void;
}) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled }}
    disabled={disabled} onPress={() => onChange(!value)} style={[styles.switchTrack, value && styles.switchOn]}>
    <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
  </Pressable>;
}

const periodName = (labelMonth: string) => `${Number(labelMonth.slice(0, 4))}年${Number(labelMonth.slice(5, 7))}月度`;

export function SettingsSheet({ settings, busy, error, dataBusy, dataMessage, onClose, onMoney, onChange, onBackup, onRestore, onRestorePrevious, onDeleteAllData }: {
  settings: Settings; busy: boolean; error: string; onClose: () => void; onMoney: () => void;
  dataBusy: boolean; dataMessage: string; onBackup: () => void; onRestore: () => void; onRestorePrevious: () => void; onDeleteAllData: () => void;
  onChange: (changes: Partial<Pick<Settings, 'monthlyNotificationEnabled' | 'startDay' | 'adjustForWeekendsAndHolidays'>>) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [draftDay, setDraftDay] = useState(settings.startDay);
  const wheelRef = useRef<ScrollView>(null);
  const { width, height } = useWindowDimensions();
  const compact = width <= 350 || height <= 700;
  const { backdropStyle, sheetStyle, close } = useBottomSheetMotion(true, onClose, height);
  const { backdropStyle: pickerBackdropStyle, sheetStyle: pickerSheetStyle, close: closePicker } =
    useBottomSheetMotion(pickerOpen, () => setPickerOpen(false), height);
  const ranges = [settings.currentPeriodRange, settings.nextPeriodRange];
  useEffect(() => {
    if (!pickerOpen) return;
    const frame = requestAnimationFrame(() => wheelRef.current?.scrollTo({ y: (settings.startDay - 1) * 48, animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [pickerOpen, settings.startDay]);
  return <Modal visible transparent animationType="none" onRequestClose={() => pickerOpen ? closePicker() : policyOpen ? setPolicyOpen(false) : close()}>
    <View style={styles.modalFill}>
      <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.backdrop} onPress={() => close()} accessibilityLabel="設定を閉じる" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { height: Math.min(height - 28, 644) }, sheetStyle]}>
        <View style={[styles.header, compact && styles.compactHeader]}>
          {policyOpen ? <View style={styles.policyHeaderLeft}>
            <Pressable accessibilityRole="button" accessibilityLabel="設定に戻る"
              onPress={() => setPolicyOpen(false)} style={styles.policyBack}>
              <ArrowLeft size={20} color={colors.ink} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>プライバシーポリシー</Text>
          </View> : <Text style={styles.title}>設定</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="設定を閉じる" onPress={() => close()} style={styles.close}><X size={16} color={colors.ink} /></Pressable>
        </View>
        {policyOpen ? <ScrollView key="privacy-policy" contentContainerStyle={styles.policyContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.policyDate}>制定日：{privacyPolicyEffectiveDate}</Text>
          {privacyPolicySections.map(section => <View key={section.title} style={styles.policySection}>
            <Text accessibilityRole="header" style={styles.policyHeading}>{section.title}</Text>
            {section.paragraphs.map(paragraph => <Text key={paragraph} style={styles.policyParagraph}>{paragraph}</Text>)}
          </View>)}
        </ScrollView> : <>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <ScrollView key="settings" contentContainerStyle={[styles.content, compact && styles.compactContent]} showsVerticalScrollIndicator={false}>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>やりくり</Text>
            <Pressable accessibilityRole="button" onPress={() => close(onMoney)} style={[styles.cardRow, styles.singleRow]}>
              <View style={styles.iconBox}><Svg width={19} height={19} viewBox="0 0 24 24" fill="none"><Path d="m9 7.5 3 4.5m0 0 3-4.5M12 12v5.25M15 12H9m6 3H9m12-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke={colors.blue} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>
              <View style={styles.rowCopy}><Text style={styles.rowTitle}>今月使える金額</Text></View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={styles.budgetValue}>¥{yen(settings.currentBudgetAmount)}</Text>
              <ChevronRight size={18} color="#8A9697" />
            </Pressable>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>通知</Text>
            <View style={styles.notificationCard}>
            <View style={styles.cardRow}>
              <View style={styles.iconBox}><Bell size={19} color={colors.blue} strokeWidth={1.8} /></View>
              <View style={styles.rowCopy}><Text style={styles.rowTitle}>月初通知</Text><Text style={styles.rowHint}>新しい月度の開始日、朝9:00にお知らせ</Text></View>
              <SettingSwitch value={settings.monthlyNotificationEnabled} disabled={busy} label="月初通知"
                onChange={value => onChange({ monthlyNotificationEnabled: value })} />
            </View>
            </View>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>期間</Text>
            <View style={styles.periodCard}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}><CalendarRange size={19} color={colors.blue} strokeWidth={1.8} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>月度の開始日</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel={`月度の開始日 ${settings.startDay}日`}
                  disabled={busy} accessibilityState={{ disabled: busy }}
                  onPress={() => { setDraftDay(settings.startDay); setPickerOpen(true); }} style={styles.daySelector}>
                  <Text style={styles.dayValue}>{settings.startDay}日</Text><ChevronRight size={18} color="#7C898A" />
                </Pressable>
              </View>
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>月度の範囲</Text>
                {ranges.map(range => <View key={range.labelMonth} style={styles.previewRow}>
                  <Text style={styles.previewName}>{periodName(range.labelMonth)}</Text>
                  <Text style={styles.previewDates}>{rangeLabel(range.startDate, range.endDate)}</Text>
                </View>)}
              </View>
              <View style={styles.cardRow}>
                <View style={styles.iconSpacer} />
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>土日祝の自動調整</Text><Text style={styles.rowHint}>月度の開始日を直前の平日に調整</Text></View>
                <SettingSwitch value={settings.adjustForWeekendsAndHolidays} disabled={busy} label="土日祝の自動調整"
                  onChange={value => onChange({ adjustForWeekendsAndHolidays: value })} />
              </View>
              <Text style={styles.holidayNotice}>{HOLIDAY_COVERAGE_NOTICE}</Text>
            </View>
          </View>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>データ</Text>
            <View style={styles.dataCard}>
              <Pressable accessibilityRole="button" accessibilityLabel="バックアップファイルを保存"
                accessibilityHint="暗号化されていないJSONファイルに予算・支出・メモを保存します"
                accessibilityState={{ disabled: dataBusy }} disabled={dataBusy} onPress={onBackup}
                style={({ pressed }) => [styles.cardRow, styles.dataRow, pressed && styles.rowPressed]}>
                <View style={styles.iconBox}><DatabaseBackup size={19} color={colors.blue} strokeWidth={1.8} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>バックアップ</Text><Text style={styles.rowHint}>暗号化されていないJSONファイルに保存</Text></View>
                <ChevronRight size={18} color="#8A9697" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="バックアップファイルから復元"
                accessibilityState={{ disabled: dataBusy }} disabled={dataBusy} onPress={onRestore}
                style={({ pressed }) => [styles.cardRow, styles.dataRow, styles.dataRowBorder, pressed && styles.rowPressed]}>
                <View style={styles.iconBox}><RotateCcw size={19} color={colors.blue} strokeWidth={1.8} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>復元</Text><Text style={styles.rowHint}>復元前のデータは端末内へ自動保存</Text></View>
                <ChevronRight size={18} color="#8A9697" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="復元前のデータに戻す"
                accessibilityState={{ disabled: dataBusy }} disabled={dataBusy} onPress={onRestorePrevious}
                style={({ pressed }) => [styles.cardRow, styles.dataRow, styles.dataRowBorder, pressed && styles.rowPressed]}>
                <View style={styles.iconBox}><History size={19} color={colors.blue} strokeWidth={1.8} /></View>
                <View style={styles.rowCopy}><Text style={styles.rowTitle}>復元前のデータに戻す</Text><Text style={styles.rowHint}>端末内の直前の自動バックアップを使用（最大5件）</Text></View>
                <ChevronRight size={18} color="#8A9697" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="全データを削除"
                accessibilityHint="確認後、端末内の予算、支出、設定、自動バックアップを削除します"
                accessibilityState={{ disabled: dataBusy }} disabled={dataBusy} onPress={onDeleteAllData}
                style={({ pressed }) => [styles.cardRow, styles.dataRow, styles.dataRowBorder, styles.deleteRow, pressed && styles.deleteRowPressed]}>
                <View style={[styles.iconBox, styles.deleteIconBox]}><Trash2 size={19} color="#F30100" strokeWidth={1.8} /></View>
                <View style={styles.rowCopy}><Text style={[styles.rowTitle, styles.deleteTitle]}>全データを削除</Text><Text style={[styles.rowHint, styles.deleteHint]}>端末内のデータを消去</Text></View>
                <ChevronRight size={18} color="#F30100" />
              </Pressable>
            </View>
            {dataBusy ? <Text style={styles.dataMessage}>処理中です…</Text> : null}
            {!dataBusy && dataMessage ? <Text accessibilityRole="alert" style={styles.dataMessage}>{dataMessage}</Text> : null}
          </View>
          <View style={styles.group}>
            <Text style={styles.groupTitle}>アプリについて</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="プライバシーポリシーを読む"
              onPress={() => setPolicyOpen(true)} style={({ pressed }) => [styles.cardRow, styles.singleRow, pressed && styles.rowPressed]}>
              <View style={styles.iconBox}><ShieldCheck size={19} color={colors.blue} strokeWidth={1.8} /></View>
              <View style={styles.rowCopy}><Text style={styles.rowTitle}>プライバシーポリシー</Text></View>
              <ChevronRight size={18} color="#8A9697" />
            </Pressable>
          </View>
        </ScrollView>
        </>}
      </Animated.View>
      {pickerOpen && <View style={styles.pickerOverlay}>
        <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, pickerBackdropStyle]}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={styles.pickerBackdrop} onPress={() => closePicker()} />
        </Animated.View>
        <Animated.View style={[styles.pickerSheet, pickerSheetStyle]}>
          <View style={styles.pickerHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="開始日の変更をキャンセル" onPress={() => closePicker()} style={styles.pickerAction}><X size={21} color={colors.ink} strokeWidth={2} /></Pressable>
            <View><Text style={styles.pickerTitle}>月度の開始日</Text><Text style={styles.pickerHint}>{draftDay}日から開始します</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="開始日を確定" disabled={busy}
              onPress={() => { closePicker(); onChange({ startDay: draftDay }); }} style={styles.pickerAction}><Check size={21} color={colors.blue} strokeWidth={2} /></Pressable>
          </View>
          <View style={styles.wheelFrame}>
            <ScrollView ref={wheelRef} style={styles.wheel} contentContainerStyle={styles.wheelContent}
              contentOffset={{ x: 0, y: (settings.startDay - 1) * 48 }}
              showsVerticalScrollIndicator={false} snapToInterval={48} decelerationRate="fast"
              onScroll={event => {
                const day = Math.max(1, Math.min(31, Math.round(event.nativeEvent.contentOffset.y / 48) + 1));
                setDraftDay(current => current === day ? current : day);
              }} scrollEventThrottle={16}>
              {Array.from({ length: 31 }, (_, index) => {
                const day = index + 1;
                return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${day}日`}
                  accessibilityState={{ selected: draftDay === day }}
                  onPress={() => { setDraftDay(day); wheelRef.current?.scrollTo({ y: index * 48, animated: false }); }}
                  style={styles.wheelItem}><Text style={[styles.wheelText, draftDay === day && styles.wheelSelected]}>{day}日</Text></Pressable>;
              })}
            </ScrollView>
            <LinearGradient pointerEvents="none" colors={['#F5F8F8', '#F5F8F800']} style={styles.wheelFadeTop} />
            <LinearGradient pointerEvents="none" colors={['#F5F8F800', '#F5F8F8']} style={styles.wheelFadeBottom} />
          </View>
        </Animated.View>
      </View>}
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  modalFill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#073F4566' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.soft,
    overflow: 'hidden', borderWidth: 1, borderColor: colors.white },
  header: { height: 74, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compactHeader: { paddingHorizontal: 18 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  policyHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  policyBack: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  policyContent: { paddingHorizontal: 24, paddingBottom: 40 },
  policyDate: { color: '#607173', fontSize: 12, lineHeight: 20 },
  policySection: { marginTop: 23, gap: 10 },
  policyHeading: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 23 },
  policyParagraph: { color: colors.ink, fontSize: 13, lineHeight: 22 },
  close: { width: 30, height: 30, marginRight: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#E7ECEC' },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  compactContent: { paddingHorizontal: 14 },
  intro: { paddingHorizontal: 5, color: '#00000094', fontSize: 11, lineHeight: 18 },
  group: { marginTop: 25 },
  groupTitle: { marginLeft: 5, marginBottom: 9, color: '#00000094', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  cardRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white },
  singleRow: { borderRadius: 20 },
  iconBox: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F4FF' },
  deleteRow: { backgroundColor: colors.white, borderTopColor: colors.line },
  deleteRowPressed: { backgroundColor: '#F7F9FA' },
  deleteIconBox: { backgroundColor: '#F3010014' },
  deleteTitle: { color: '#F30100' },
  deleteHint: { color: '#F30100B3' },
  iconSpacer: { width: 38 },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  rowHint: { color: '#0000007A', fontSize: 9 },
  holidayNotice: { marginHorizontal: 14, marginBottom: 16, color: '#637073', fontSize: 11, lineHeight: 18 },
  budgetValue: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 15, fontWeight: '600', maxWidth: '38%', flexShrink: 1 },
  switchTrack: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: 'center', backgroundColor: '#C8D0D1' },
  switchOn: { backgroundColor: colors.blue },
  switchThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, shadowColor: '#183638',
    shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  switchThumbOn: { alignSelf: 'flex-end' },
  periodCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.white },
  dataCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.white },
  notificationCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.white },
  dataRow: { minHeight: 68 },
  dataRowBorder: { borderTopWidth: 1, borderTopColor: '#EDF1F1' },
  rowPressed: { backgroundColor: '#F1F7FB' },
  dataMessage: { marginHorizontal: 5, marginTop: 8, color: '#607173', fontSize: 10, lineHeight: 15 },
  daySelector: { minWidth: 80, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  dayValue: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 11, fontWeight: '600' },
  preview: { marginLeft: 62, marginRight: 14, paddingTop: 10, paddingBottom: 11, borderTopWidth: 1, borderColor: '#EDF1F1' },
  previewTitle: { color: '#6C787A', fontSize: 9, fontWeight: '700', marginBottom: 7 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: 8 },
  previewName: { fontFamily: 'ui-rounded', color: colors.ink, fontSize: 10, fontWeight: '600' },
  previewDates: { fontFamily: 'ui-rounded', color: colors.blue, fontSize: 10, fontWeight: '600' },
  error: { marginHorizontal: 24, marginBottom: 8, color: '#B33340', fontSize: 13 },
  pickerOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: '#1727288A' },
  pickerSheet: { backgroundColor: '#F5F8F8', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden', borderWidth: 1, borderColor: '#FFFFFFB8', paddingHorizontal: 20, paddingBottom: 22 },
  pickerHeader: { height: 92, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerAction: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#DCE4E5',
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  pickerTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  pickerHint: { color: colors.muted, fontSize: 10, textAlign: 'center', marginTop: 4 },
  wheelFrame: { height: 256, position: 'relative' },
  wheel: { height: 256 },
  wheelContent: { paddingVertical: 104 },
  wheelItem: { height: 48, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontFamily: 'ui-rounded', color: '#899395', fontSize: 18, fontWeight: '600' },
  wheelSelected: { color: colors.ink, fontSize: 21, fontWeight: '600' },
  wheelFadeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  wheelFadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
});
