export type FieldType = 'text' | 'textarea' | 'image' | 'repeater';

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

export interface RepeaterFieldDef extends BaseFieldDef {
  type: 'repeater';
  itemLabel: string;
  itemFields: (TextFieldDef | ImageFieldDef)[];
  defaultValue: Record<string, any>[];
}

export type FieldDef = TextFieldDef | ImageFieldDef | RepeaterFieldDef;

export interface PageManifest {
  page: string;
  label: string;
  fields: FieldDef[];
}
