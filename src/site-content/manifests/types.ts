export type FieldType = 'text' | 'textarea' | 'image' | 'video' | 'repeater';

export interface BaseFieldDef {
  key: string;
  label: string;
  type: FieldType;
  section?: string;
  helpText?: string;
}

export interface TextFieldDef extends BaseFieldDef {
  type: 'text' | 'textarea';
  defaultValue: string;
  maxLength?: number;
}

export interface ImageFieldDef extends BaseFieldDef {
  type: 'image';
  defaultValue: string;
}

export interface VideoFieldDef extends BaseFieldDef {
  type: 'video';
  defaultValue: string;
}

export interface RepeaterFieldDef extends BaseFieldDef {
  type: 'repeater';
  itemLabel: string;
  itemFields: (TextFieldDef | ImageFieldDef | VideoFieldDef)[];
  defaultValue: Record<string, any>[];
}

export type FieldDef = TextFieldDef | ImageFieldDef | VideoFieldDef | RepeaterFieldDef;

export interface PageManifest {
  page: string;
  label: string;
  fields: FieldDef[];
}
